/**
 * Unit tests for ReceiverEmulator.
 *
 * Tests verify:
 * - Block format correctness
 * - Sequence number monotonicity
 * - Correct sample count per block
 * - Receiver ID propagation
 */

#include <gtest/gtest.h>
#include "emulator.h"

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <mutex>
#include <vector>

using namespace nextsdr;

static EmulatorConfig make_config(const std::string& receiver_id = "test-rx-1")
{
    EmulatorConfig cfg;
    cfg.receiver_id = receiver_id;
    cfg.window_id = "test-window-1";
    cfg.centre_frequency_hz = 145'000'000;
    cfg.sample_rate_hz = 2'048'000;
    cfg.signals.push_back({
        SyntheticSignal::Type::NOISE,
        0.0,
        -80.0,
    });
    return cfg;
}

TEST(ReceiverEmulatorTest, BlockHasCorrectSampleCount)
{
    auto cfg = make_config();
    ReceiverEmulator emulator(cfg);

    std::mutex mtx;
    std::condition_variable cv;
    std::vector<IQBlock> received;

    emulator.start([&](const IQBlock& block) {
        std::lock_guard<std::mutex> lock(mtx);
        received.push_back(block);
        cv.notify_one();
    });

    // Wait for at least one block
    {
        std::unique_lock<std::mutex> lock(mtx);
        cv.wait_for(lock, std::chrono::seconds(5),
                    [&] { return !received.empty(); });
    }

    emulator.stop();

    ASSERT_FALSE(received.empty());
    const auto& block = received.front();
    // payload is I+Q interleaved int16_t — expect 2 * IQ_BLOCK_SAMPLES elements
    EXPECT_EQ(block.payload.size(), static_cast<size_t>(IQ_BLOCK_SAMPLES * 2));
}

TEST(ReceiverEmulatorTest, ReceiverIdPropagatedToBlock)
{
    auto cfg = make_config("specific-rx-id");
    ReceiverEmulator emulator(cfg);

    std::mutex mtx;
    std::condition_variable cv;
    std::string observed_id;

    emulator.start([&](const IQBlock& block) {
        std::lock_guard<std::mutex> lock(mtx);
        observed_id = block.receiver_id;
        cv.notify_one();
    });

    {
        std::unique_lock<std::mutex> lock(mtx);
        cv.wait_for(lock, std::chrono::seconds(5),
                    [&] { return !observed_id.empty(); });
    }

    emulator.stop();

    EXPECT_EQ(observed_id, "specific-rx-id");
}

TEST(ReceiverEmulatorTest, SequenceNumbersAreMonotonic)
{
    auto cfg = make_config();
    ReceiverEmulator emulator(cfg);

    std::mutex mtx;
    std::condition_variable cv;
    std::vector<uint64_t> seq_numbers;
    constexpr int TARGET = 5;

    emulator.start([&](const IQBlock& block) {
        std::lock_guard<std::mutex> lock(mtx);
        seq_numbers.push_back(block.sequence_number);
        if (static_cast<int>(seq_numbers.size()) >= TARGET) {
            cv.notify_one();
        }
    });

    {
        std::unique_lock<std::mutex> lock(mtx);
        cv.wait_for(lock, std::chrono::seconds(10),
                    [&] { return static_cast<int>(seq_numbers.size()) >= TARGET; });
    }

    emulator.stop();

    ASSERT_GE(static_cast<int>(seq_numbers.size()), TARGET);
    for (size_t i = 1; i < seq_numbers.size(); ++i) {
        EXPECT_GT(seq_numbers[i], seq_numbers[i - 1])
            << "Sequence number not monotonic at index " << i;
    }
}

TEST(ReceiverEmulatorTest, CentreFrequencyPropagated)
{
    auto cfg = make_config();
    cfg.centre_frequency_hz = 144'500'000;
    ReceiverEmulator emulator(cfg);

    std::mutex mtx;
    std::condition_variable cv;
    uint64_t observed_freq = 0;

    emulator.start([&](const IQBlock& block) {
        std::lock_guard<std::mutex> lock(mtx);
        observed_freq = block.centre_frequency_hz;
        cv.notify_one();
    });

    {
        std::unique_lock<std::mutex> lock(mtx);
        cv.wait_for(lock, std::chrono::seconds(5),
                    [&] { return observed_freq != 0; });
    }

    emulator.stop();

    EXPECT_EQ(observed_freq, static_cast<uint64_t>(144'500'000));
}

TEST(ReceiverEmulatorTest, CannotStartTwice)
{
    auto cfg = make_config();
    ReceiverEmulator emulator(cfg);

    emulator.start([](const IQBlock&) {});

    EXPECT_THROW(emulator.start([](const IQBlock&) {}), std::runtime_error);

    emulator.stop();
}

TEST(ReceiverEmulatorTest, StopIsIdempotent)
{
    auto cfg = make_config();
    ReceiverEmulator emulator(cfg);

    emulator.start([](const IQBlock&) {});
    emulator.stop();
    emulator.stop(); // Should not throw or crash
}
