/**
 * channel-service entry point.
 *
 * Receives wideband IQ blocks from the receiver emulator/rtlsdr,
 * dispatches them to channel workers, and streams audio to listeners.
 */

#include <atomic>
#include <csignal>
#include <cstdlib>
#include <iostream>
#include <map>
#include <memory>
#include <mutex>
#include <thread>

#include "channel_worker.h"

static std::atomic<bool> g_shutdown{false};

static void signal_handler(int) { g_shutdown.store(true); }

int main()
{
    std::signal(SIGTERM, signal_handler);
    std::signal(SIGINT, signal_handler);

    const std::string scheduler_url =
        std::getenv("SCHEDULER_URL") ? std::getenv("SCHEDULER_URL") : "http://scheduler:3002";

    std::cout << "[channel-service] Starting\n";
    std::cout << "[channel-service] Scheduler: " << scheduler_url << '\n';

    // Channel worker registry
    std::map<std::string, std::unique_ptr<nextsdr::ChannelWorker>> workers;
    std::mutex workers_mtx;

    // In full implementation:
    //   - Listen for IQ UDP/ZMQ stream from receiver-emulator
    //   - Accept HTTP requests to create/destroy channel workers
    //   - Route IQ blocks to appropriate workers based on window_id
    //
    // For the Phase 0 skeleton, we run a readiness loop until shutdown.

    std::cout << "[channel-service] Ready (skeleton — awaiting channel requests)\n";

    while (!g_shutdown.load()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    std::cout << "[channel-service] Shutting down\n";
    {
        std::lock_guard<std::mutex> lock(workers_mtx);
        for (auto& [id, worker] : workers) {
            worker->stop();
        }
    }

    return 0;
}
