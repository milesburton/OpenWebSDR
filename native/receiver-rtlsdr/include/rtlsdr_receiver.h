#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <thread>
#include <vector>

namespace nextsdr {

// Forward declare the IQBlock from the emulator header (shared format)
struct IQBlock;
using IQBlockCallback = std::function<void(const IQBlock&)>;

/**
 * RTLSDRReceiver wraps librtlsdr to expose the same interface as ReceiverEmulator.
 *
 * Design principles:
 *   - One RTLSDRReceiver instance per physical device.
 *   - The device is exclusively owned by this process.
 *   - Control-plane code does not interact with librtlsdr directly.
 */
class RTLSDRReceiver {
public:
    struct Config {
        std::string receiver_id;
        std::string window_id;
        int device_index{0};
        uint64_t centre_frequency_hz{145'000'000};
        uint32_t sample_rate_hz{2'048'000};
        int gain_db{0};
        bool agc_enabled{true};
    };

    explicit RTLSDRReceiver(Config config);
    ~RTLSDRReceiver();

    RTLSDRReceiver(const RTLSDRReceiver&) = delete;
    RTLSDRReceiver& operator=(const RTLSDRReceiver&) = delete;

    void start(IQBlockCallback callback);
    void stop();
    bool is_running() const { return running_.load(std::memory_order_acquire); }

    static std::vector<std::string> list_devices();

private:
    struct DeviceHandle;
    void stream_loop(IQBlockCallback callback);
    static void rtlsdr_callback(
        unsigned char* buf,
        uint32_t len,
        void* ctx);

    Config config_;
    std::atomic<bool> running_{false};
    std::unique_ptr<DeviceHandle> device_;
    std::thread stream_thread_;
    uint64_t sequence_counter_{0};
    IQBlockCallback active_callback_;
};

} // namespace nextsdr
