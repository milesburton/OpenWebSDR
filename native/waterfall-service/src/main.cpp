#include <atomic>
#include <csignal>
#include <iostream>
#include <thread>

#include "waterfall_generator.h"

static std::atomic<bool> g_shutdown{false};
static void signal_handler(int) { g_shutdown.store(true); }

int main()
{
    std::signal(SIGTERM, signal_handler);
    std::signal(SIGINT, signal_handler);

    std::cout << "[waterfall-service] Starting (skeleton)\n";

    nextsdr::WaterfallGenerator generator({
        .fft_size = 1024,
        .update_rate_hz = 20,
        .window_sample_rate_hz = 2'048'000,
    });

    generator.start();

    // In full implementation:
    //   - Subscribe to IQ stream from receiver-emulator
    //   - Deliver FFT lines to session-gateway via WebSocket
    //
    // For Phase 0, run until shutdown.

    while (!g_shutdown.load()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    std::cout << "[waterfall-service] Shutting down\n";
    generator.stop();
    return 0;
}
