#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <thread>
#include <vector>

namespace nextsdr {

/**
 * IQ block as defined in the platform contracts.
 * Every block is fixed-size: IQ_BLOCK_SAMPLES I+Q pairs of int16_t.
 */
static constexpr uint32_t IQ_BLOCK_SAMPLES = 65536;

struct IQBlock {
    std::string receiver_id;
    std::string window_id;
    uint64_t sequence_number;
    uint64_t timestamp_ms;      ///< Unix epoch milliseconds
    uint32_t sample_rate_hz;
    uint64_t centre_frequency_hz;
    /// Raw IQ data: interleaved I, Q as int16_t (CS16 format)
    std::vector<int16_t> payload;
    /// Flags
    bool dropped{false};
    bool corrupt{false};
    bool overflow{false};
    bool end_of_stream{false};
};

using IQBlockCallback = std::function<void(const IQBlock&)>;

/**
 * Signal descriptor for synthetic signal generation.
 */
struct SyntheticSignal {
    enum class Type { TONE, NFM, FM, NOISE };
    Type type;
    double centre_frequency_hz;
    double amplitude_dbfs;
    // FM/NFM parameters
    double deviation_hz{5000.0};
    double modulation_frequency_hz{1000.0};
};

/**
 * Fault injection configuration.
 */
struct FaultConfig {
    double drop_probability{0.0};
    double corrupt_probability{0.0};
    double stall_probability{0.0};
    uint32_t stall_duration_ms{500};
    uint32_t disconnect_after_seconds{0}; ///< 0 = never
};

/**
 * Emulator configuration.
 */
struct EmulatorConfig {
    std::string receiver_id;
    std::string window_id;
    uint64_t centre_frequency_hz{145'000'000};
    uint32_t sample_rate_hz{2'048'000};
    std::vector<SyntheticSignal> signals;
    FaultConfig faults;
    /** Endpoint to POST IQ blocks to (empty = use callback only) */
    std::string stream_endpoint;
};

/**
 * ReceiverEmulator simulates an SDR receiver.
 *
 * It generates synthetic IQ samples based on the configured scene,
 * applies fault injection as configured, and delivers blocks either
 * via callback or HTTP POST to the stream endpoint.
 */
class ReceiverEmulator {
public:
    explicit ReceiverEmulator(EmulatorConfig config);
    ~ReceiverEmulator();

    ReceiverEmulator(const ReceiverEmulator&) = delete;
    ReceiverEmulator& operator=(const ReceiverEmulator&) = delete;

    /**
     * Start streaming IQ blocks.
     * @param callback Called for each generated block.
     */
    void start(IQBlockCallback callback);

    /**
     * Stop the stream gracefully.
     * Blocks until the streaming thread exits.
     */
    void stop();

    bool is_running() const { return running_.load(std::memory_order_acquire); }

    const EmulatorConfig& config() const { return config_; }

private:
    void stream_loop(IQBlockCallback callback);
    IQBlock generate_block();
    void synthesise_signal(
        const SyntheticSignal& signal,
        std::vector<int16_t>& payload,
        uint64_t block_index) const;
    bool should_inject_fault(double probability) const;

    EmulatorConfig config_;
    std::atomic<bool> running_{false};
    std::thread stream_thread_;
    uint64_t sequence_counter_{0};
};

} // namespace nextsdr
