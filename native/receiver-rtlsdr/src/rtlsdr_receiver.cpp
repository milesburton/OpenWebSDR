#include "rtlsdr_receiver.h"

// Shared IQ block type from emulator
#include "../../receiver-emulator/include/emulator.h"

#ifdef HAVE_RTLSDR
#  include <rtl-sdr.h>
#else
// Stub types for compile-time verification without hardware
struct rtlsdr_dev;
using rtlsdr_dev_t = rtlsdr_dev*;
#endif

#include <cassert>
#include <chrono>
#include <iostream>
#include <stdexcept>
#include <vector>

namespace nextsdr {

struct RTLSDRReceiver::DeviceHandle {
#ifdef HAVE_RTLSDR
    rtlsdr_dev_t dev{nullptr};
#endif
};

RTLSDRReceiver::RTLSDRReceiver(Config config)
    : config_(std::move(config))
    , device_(std::make_unique<DeviceHandle>())
{
}

RTLSDRReceiver::~RTLSDRReceiver()
{
    stop();
}

std::vector<std::string> RTLSDRReceiver::list_devices()
{
#ifdef HAVE_RTLSDR
    const uint32_t count = rtlsdr_get_device_count();
    std::vector<std::string> names;
    names.reserve(count);
    for (uint32_t i = 0; i < count; ++i) {
        names.emplace_back(rtlsdr_get_device_name(i));
    }
    return names;
#else
    std::cerr << "[rtlsdr] librtlsdr not compiled in — no devices available\n";
    return {};
#endif
}

void RTLSDRReceiver::start(IQBlockCallback callback)
{
    if (running_.exchange(true, std::memory_order_acq_rel)) {
        throw std::runtime_error("RTLSDRReceiver is already running");
    }

#ifdef HAVE_RTLSDR
    if (rtlsdr_open(&device_->dev, static_cast<uint32_t>(config_.device_index)) != 0) {
        running_.store(false);
        throw std::runtime_error("Failed to open RTL-SDR device index " +
                                 std::to_string(config_.device_index));
    }

    rtlsdr_set_sample_rate(device_->dev, config_.sample_rate_hz);
    rtlsdr_set_center_freq(device_->dev, static_cast<uint32_t>(config_.centre_frequency_hz));

    if (config_.agc_enabled) {
        rtlsdr_set_agc_mode(device_->dev, 1);
        rtlsdr_set_tuner_gain_mode(device_->dev, 0);
    } else {
        rtlsdr_set_agc_mode(device_->dev, 0);
        rtlsdr_set_tuner_gain_mode(device_->dev, 1);
        rtlsdr_set_tuner_gain(device_->dev, config_.gain_db * 10);
    }

    rtlsdr_reset_buffer(device_->dev);
#else
    std::cerr << "[rtlsdr] Running without hardware — streaming silence\n";
#endif

    active_callback_ = std::move(callback);
    stream_thread_ = std::thread([this] { stream_loop(active_callback_); });
}

void RTLSDRReceiver::stop()
{
    running_.store(false, std::memory_order_release);

#ifdef HAVE_RTLSDR
    if (device_->dev) {
        rtlsdr_cancel_async(device_->dev);
    }
#endif

    if (stream_thread_.joinable()) {
        stream_thread_.join();
    }

#ifdef HAVE_RTLSDR
    if (device_->dev) {
        rtlsdr_close(device_->dev);
        device_->dev = nullptr;
    }
#endif
}

void RTLSDRReceiver::stream_loop(IQBlockCallback callback)
{
#ifdef HAVE_RTLSDR
    // RTL-SDR async read — callback receives CU8 samples
    rtlsdr_read_async(
        device_->dev,
        &RTLSDRReceiver::rtlsdr_callback,
        this,
        0, // use default buffer count
        IQ_BLOCK_SAMPLES * 2 // CU8: 1 byte per I or Q
    );
#else
    // Stub: deliver empty blocks at the right rate
    using Clock = std::chrono::steady_clock;
    const double block_duration_s =
        static_cast<double>(IQ_BLOCK_SAMPLES) / config_.sample_rate_hz;
    const auto block_duration = std::chrono::duration_cast<std::chrono::nanoseconds>(
        std::chrono::duration<double>(block_duration_s));

    auto next = Clock::now();
    while (running_.load(std::memory_order_acquire)) {
        IQBlock block;
        block.receiver_id = config_.receiver_id;
        block.window_id = config_.window_id;
        block.sequence_number = sequence_counter_++;
        block.timestamp_ms = static_cast<uint64_t>(
            std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch())
                .count());
        block.sample_rate_hz = config_.sample_rate_hz;
        block.centre_frequency_hz = config_.centre_frequency_hz;
        block.payload.assign(IQ_BLOCK_SAMPLES * 2, 0);
        callback(block);

        next += block_duration;
        std::this_thread::sleep_until(next);
    }
#endif
}

#ifdef HAVE_RTLSDR
void RTLSDRReceiver::rtlsdr_callback(
    unsigned char* buf,
    uint32_t len,
    void* ctx)
{
    auto* self = static_cast<RTLSDRReceiver*>(ctx);
    if (!self->running_.load(std::memory_order_acquire)) return;

    // Convert CU8 → CS16
    const uint32_t n_samples = len / 2;
    IQBlock block;
    block.receiver_id = self->config_.receiver_id;
    block.window_id = self->config_.window_id;
    block.sequence_number = self->sequence_counter_++;
    block.sample_rate_hz = self->config_.sample_rate_hz;
    block.centre_frequency_hz = self->config_.centre_frequency_hz;
    block.payload.resize(n_samples * 2);

    for (uint32_t i = 0; i < n_samples; ++i) {
        // CU8: unsigned 8-bit, centred at 128
        // Convert to signed 16-bit
        block.payload[i * 2 + 0] =
            static_cast<int16_t>((static_cast<int>(buf[i * 2 + 0]) - 128) * 256);
        block.payload[i * 2 + 1] =
            static_cast<int16_t>((static_cast<int>(buf[i * 2 + 1]) - 128) * 256);
    }

    self->active_callback_(block);
}
#endif

} // namespace nextsdr
