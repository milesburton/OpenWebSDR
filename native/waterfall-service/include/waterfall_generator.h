#pragma once

#include <cstdint>
#include <functional>
#include <memory>
#include <vector>

namespace nextsdr {

/**
 * WaterfallGenerator produces FFT-based waterfall data from wideband IQ blocks.
 *
 * For each IQ block received, it computes a power spectrum and delivers
 * a waterfall line (FFT_SIZE floats in dBFS) to registered consumers.
 */
class WaterfallGenerator {
public:
    using WaterfallLineCallback = std::function<void(const std::vector<float>&)>;

    struct Config {
        uint32_t fft_size{1024};
        uint32_t update_rate_hz{20}; ///< Waterfall lines per second
        uint32_t window_sample_rate_hz{2'048'000};
    };

    explicit WaterfallGenerator(Config config);
    ~WaterfallGenerator();

    /**
     * Submit a wideband IQ block.
     * Thread-safe.
     */
    void submit_iq_block(const std::vector<int16_t>& iq_payload);

    /**
     * Register a callback to receive waterfall lines.
     * Returns a subscription ID.
     */
    uint32_t subscribe(WaterfallLineCallback callback);

    /**
     * Unsubscribe from waterfall updates.
     */
    void unsubscribe(uint32_t subscription_id);

    void start();
    void stop();

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace nextsdr
