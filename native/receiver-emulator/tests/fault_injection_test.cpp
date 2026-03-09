#include <gtest/gtest.h>
#include "emulator.h"

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <mutex>
#include <vector>

using namespace nextsdr;

static EmulatorConfig make_fault_config()
{
    EmulatorConfig cfg;
    cfg.receiver_id = "fault-test-rx";
    cfg.window_id = "fault-test-window";
    cfg.centre_frequency_hz = 145'000'000;
    cfg.sample_rate_hz = 2'048'000;
    cfg.signals.push_back({SyntheticSignal::Type::NOISE, 0.0, -80.0});
    return cfg;
}

TEST(FaultInjectionTest, DropFaultProducesDroppedBlocks)
{
    auto cfg = make_fault_config();
    cfg.faults.drop_probability = 0.5; // 50% drop rate — easy to detect statistically

    ReceiverEmulator emulator(cfg);

    std::mutex mtx;
    std::condition_variable cv;
    std::vector<IQBlock> blocks;
    constexpr int TARGET = 20;

    emulator.start([&](const IQBlock& block) {
        std::lock_guard<std::mutex> lock(mtx);
        blocks.push_back(block);
        if (static_cast<int>(blocks.size()) >= TARGET) cv.notify_one();
    });

    {
        std::unique_lock<std::mutex> lock(mtx);
        cv.wait_for(lock, std::chrono::seconds(30),
                    [&] { return static_cast<int>(blocks.size()) >= TARGET; });
    }

    emulator.stop();

    ASSERT_GE(static_cast<int>(blocks.size()), TARGET);

    int dropped_count = 0;
    for (const auto& b : blocks) {
        if (b.dropped) ++dropped_count;
    }

    // With 50% probability and 20 blocks, we expect at least a few drops
    EXPECT_GT(dropped_count, 0)
        << "Expected some dropped blocks with 50% drop probability";
}

TEST(FaultInjectionTest, EndOfStreamDeliveredOnDisconnect)
{
    auto cfg = make_fault_config();
    cfg.faults.disconnect_after_seconds = 2; // Disconnect after 2 seconds

    ReceiverEmulator emulator(cfg);

    std::mutex mtx;
    std::condition_variable cv;
    bool eos_received = false;

    emulator.start([&](const IQBlock& block) {
        if (block.end_of_stream) {
            std::lock_guard<std::mutex> lock(mtx);
            eos_received = true;
            cv.notify_one();
        }
    });

    {
        std::unique_lock<std::mutex> lock(mtx);
        cv.wait_for(lock, std::chrono::seconds(10),
                    [&] { return eos_received; });
    }

    emulator.stop();

    EXPECT_TRUE(eos_received);
}

TEST(FaultInjectionTest, NormalBlocksHaveNoFaultFlags)
{
    auto cfg = make_fault_config();
    // No faults configured

    ReceiverEmulator emulator(cfg);

    std::mutex mtx;
    std::condition_variable cv;
    std::vector<IQBlock> blocks;
    constexpr int TARGET = 10;

    emulator.start([&](const IQBlock& block) {
        std::lock_guard<std::mutex> lock(mtx);
        blocks.push_back(block);
        if (static_cast<int>(blocks.size()) >= TARGET) cv.notify_one();
    });

    {
        std::unique_lock<std::mutex> lock(mtx);
        cv.wait_for(lock, std::chrono::seconds(30),
                    [&] { return static_cast<int>(blocks.size()) >= TARGET; });
    }

    emulator.stop();

    for (const auto& b : blocks) {
        EXPECT_FALSE(b.dropped);
        EXPECT_FALSE(b.corrupt);
        EXPECT_FALSE(b.overflow);
        EXPECT_FALSE(b.end_of_stream);
    }
}
