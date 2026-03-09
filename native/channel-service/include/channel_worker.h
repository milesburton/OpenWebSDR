#pragma once

#include <atomic>
#include <functional>
#include <memory>
#include <string>
#include <thread>
#include <vector>

namespace nextsdr {

class ChannelWorker {
public:
    struct Config {
        std::string channel_id;
        std::string window_id;
        uint64_t window_centre_hz;
        uint32_t window_sample_rate_hz;
        uint64_t channel_centre_hz;
        uint32_t channel_bandwidth_hz;
        uint32_t audio_sample_rate_hz;
        std::string demod_mode; // "NFM", "FM", "AM"
        float deviation_hz;
    };

    using AudioCallback = std::function<void(const std::vector<float>&)>;

    explicit ChannelWorker(Config config);
    ~ChannelWorker();

    void start(AudioCallback audio_callback);
    void stop();
    bool is_active() const { return active_.load(std::memory_order_acquire); }

    void submit_iq_block(const std::vector<int16_t>& iq_payload);

    const Config& config() const { return config_; }
    int listener_count() const { return listener_count_.load(); }
    void add_listener() { ++listener_count_; }
    void remove_listener();

private:
    void process_loop(AudioCallback callback);

    Config config_;
    std::atomic<bool> active_{false};
    std::atomic<int> listener_count_{0};

    // Thread-safe queue for IQ blocks
    struct IQQueue;
    std::unique_ptr<IQQueue> queue_;
    std::thread worker_thread_;
};

} // namespace nextsdr
