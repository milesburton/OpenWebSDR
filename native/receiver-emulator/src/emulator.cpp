/**
 * ReceiverEmulator implementation.
 *
 * Generates synthetic IQ samples representing an RF scene over the 2 m amateur band.
 * Supports FM/NFM signal synthesis, additive white Gaussian noise, and fault injection.
 */

#include "emulator.h"

#include <algorithm>
#include <cassert>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <random>
#include <stdexcept>
#include <thread>

namespace nextsdr {

static constexpr double PI = 3.14159265358979323846;
static constexpr double TWO_PI = 2.0 * PI;

ReceiverEmulator::ReceiverEmulator(EmulatorConfig config)
    : config_(std::move(config))
{
    if (config_.receiver_id.empty()) {
        throw std::invalid_argument("EmulatorConfig: receiver_id must not be empty");
    }
}

ReceiverEmulator::~ReceiverEmulator()
{
    stop();
}

void ReceiverEmulator::start(IQBlockCallback callback)
{
    if (running_.exchange(true, std::memory_order_acq_rel)) {
        throw std::runtime_error("Emulator is already running");
    }
    stream_thread_ = std::thread([this, cb = std::move(callback)]() mutable {
        stream_loop(std::move(cb));
    });
}

void ReceiverEmulator::stop()
{
    running_.store(false, std::memory_order_release);
    if (stream_thread_.joinable()) {
        stream_thread_.join();
    }
}

void ReceiverEmulator::stream_loop(IQBlockCallback callback)
{
    using Clock = std::chrono::steady_clock;
    using namespace std::chrono_literals;

    const double samples_per_block = static_cast<double>(IQ_BLOCK_SAMPLES);
    const double block_duration_s = samples_per_block / config_.sample_rate_hz;
    const auto block_duration = std::chrono::duration_cast<std::chrono::nanoseconds>(
        std::chrono::duration<double>(block_duration_s));

    auto next_block_time = Clock::now();
    uint64_t block_index = 0;
    uint32_t uptime_seconds = 0;

    std::chrono::seconds uptime_counter{0};
    auto start_time = Clock::now();

    while (running_.load(std::memory_order_acquire)) {
        // Check disconnect fault
        if (config_.faults.disconnect_after_seconds > 0) {
            auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
                Clock::now() - start_time);
            if (elapsed.count() >= static_cast<long long>(config_.faults.disconnect_after_seconds)) {
                std::cout << "[emulator] Injecting planned disconnect after "
                          << config_.faults.disconnect_after_seconds << "s\n";
                IQBlock eos_block = generate_block();
                eos_block.end_of_stream = true;
                callback(eos_block);
                break;
            }
        }

        // Check stall fault
        if (config_.faults.stall_probability > 0.0 &&
            should_inject_fault(config_.faults.stall_probability / 50.0)) {
            std::cerr << "[emulator] Injecting stream stall for "
                      << config_.faults.stall_duration_ms << "ms\n";
            std::this_thread::sleep_for(
                std::chrono::milliseconds(config_.faults.stall_duration_ms));
            next_block_time = Clock::now();
            continue;
        }

        IQBlock block = generate_block();
        block.sequence_number = sequence_counter_++;

        // Apply drop fault
        if (config_.faults.drop_probability > 0.0 &&
            should_inject_fault(config_.faults.drop_probability)) {
            block.dropped = true;
            callback(block);
            ++block_index;
            next_block_time += block_duration;
            std::this_thread::sleep_until(next_block_time);
            continue;
        }

        // Apply corrupt fault
        if (config_.faults.corrupt_probability > 0.0 &&
            should_inject_fault(config_.faults.corrupt_probability)) {
            block.corrupt = true;
            // Randomise a few samples to simulate corruption
            for (size_t i = 0; i < 64 && i < block.payload.size(); ++i) {
                block.payload[i] = static_cast<int16_t>(std::rand() % 65536 - 32768);
            }
        }

        callback(block);
        ++block_index;

        next_block_time += block_duration;
        std::this_thread::sleep_until(next_block_time);
    }
}

IQBlock ReceiverEmulator::generate_block()
{
    using Clock = std::chrono::system_clock;
    auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        Clock::now().time_since_epoch()).count();

    IQBlock block;
    block.receiver_id = config_.receiver_id;
    block.window_id = config_.window_id;
    block.timestamp_ms = static_cast<uint64_t>(now_ms);
    block.sample_rate_hz = config_.sample_rate_hz;
    block.centre_frequency_hz = config_.centre_frequency_hz;
    block.payload.resize(IQ_BLOCK_SAMPLES * 2, 0); // I, Q interleaved

    uint64_t block_index = sequence_counter_;

    // Synthesise each configured signal
    for (const auto& signal : config_.signals) {
        synthesise_signal(signal, block.payload, block_index);
    }

    return block;
}

void ReceiverEmulator::synthesise_signal(
    const SyntheticSignal& signal,
    std::vector<int16_t>& payload,
    uint64_t block_index) const
{
    static thread_local std::mt19937 rng{std::random_device{}()};
    const double amplitude = std::pow(10.0, signal.amplitude_dbfs / 20.0) * 32767.0;

    switch (signal.type) {
        case SyntheticSignal::Type::NOISE: {
            std::normal_distribution<double> dist(0.0, amplitude * 0.707);
            for (size_t i = 0; i < IQ_BLOCK_SAMPLES; ++i) {
                payload[i * 2 + 0] = static_cast<int16_t>(
                    std::clamp(dist(rng), -32768.0, 32767.0));
                payload[i * 2 + 1] = static_cast<int16_t>(
                    std::clamp(dist(rng), -32768.0, 32767.0));
            }
            break;
        }

        case SyntheticSignal::Type::TONE: {
            // Frequency offset from window centre
            const double freq_offset_hz =
                signal.centre_frequency_hz - static_cast<double>(config_.centre_frequency_hz);
            const double phase_per_sample =
                TWO_PI * freq_offset_hz / config_.sample_rate_hz;
            const double base_phase =
                phase_per_sample * static_cast<double>(block_index * IQ_BLOCK_SAMPLES);

            for (size_t i = 0; i < IQ_BLOCK_SAMPLES; ++i) {
                const double phase = base_phase + phase_per_sample * i;
                payload[i * 2 + 0] += static_cast<int16_t>(amplitude * std::cos(phase));
                payload[i * 2 + 1] += static_cast<int16_t>(amplitude * std::sin(phase));
            }
            break;
        }

        case SyntheticSignal::Type::NFM:
        case SyntheticSignal::Type::FM: {
            // FM modulation: phase integrates the frequency deviation
            const double freq_offset_hz =
                signal.centre_frequency_hz - static_cast<double>(config_.centre_frequency_hz);
            const double carrier_phase_per_sample =
                TWO_PI * freq_offset_hz / config_.sample_rate_hz;
            const double mod_phase_per_sample =
                TWO_PI * signal.modulation_frequency_hz / config_.sample_rate_hz;
            const double mod_index =
                signal.deviation_hz / signal.modulation_frequency_hz;

            const double base_carrier_phase =
                carrier_phase_per_sample *
                static_cast<double>(block_index * IQ_BLOCK_SAMPLES);
            const double base_mod_phase =
                mod_phase_per_sample *
                static_cast<double>(block_index * IQ_BLOCK_SAMPLES);

            for (size_t i = 0; i < IQ_BLOCK_SAMPLES; ++i) {
                const double mod_phase = base_mod_phase + mod_phase_per_sample * i;
                const double instantaneous_phase =
                    base_carrier_phase +
                    carrier_phase_per_sample * i +
                    mod_index * std::sin(mod_phase);

                payload[i * 2 + 0] += static_cast<int16_t>(
                    amplitude * std::cos(instantaneous_phase));
                payload[i * 2 + 1] += static_cast<int16_t>(
                    amplitude * std::sin(instantaneous_phase));
            }
            break;
        }
    }
}

bool ReceiverEmulator::should_inject_fault(double probability) const
{
    static thread_local std::mt19937 rng{std::random_device{}()};
    static thread_local std::uniform_real_distribution<double> dist(0.0, 1.0);
    return dist(rng) < probability;
}

} // namespace nextsdr
