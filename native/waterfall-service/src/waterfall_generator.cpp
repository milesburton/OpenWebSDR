/**
 * WaterfallGenerator implementation.
 */

#include "waterfall_generator.h"

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <iostream>
#include <map>
#include <mutex>
#include <queue>
#include <thread>

#include "../../dsp-core/include/dsp_core.h"

namespace nextsdr {

struct WaterfallGenerator::Impl {
    Config config;
    dsp::FFTProcessor fft;

    std::queue<std::vector<int16_t>> iq_queue;
    std::mutex queue_mtx;
    std::condition_variable queue_cv;
    bool closed{false};

    std::map<uint32_t, WaterfallLineCallback> subscribers;
    std::mutex sub_mtx;
    uint32_t next_sub_id{1};

    std::atomic<bool> running{false};
    std::thread worker;

    explicit Impl(Config cfg)
        : config(cfg)
        , fft(cfg.fft_size)
    {
    }

    void worker_loop()
    {
        const uint32_t blocks_per_line =
            config.window_sample_rate_hz /
            (config.fft_size * config.update_rate_hz);

        uint32_t block_counter = 0;

        while (true) {
            std::vector<int16_t> iq_block;
            {
                std::unique_lock<std::mutex> lock(queue_mtx);
                queue_cv.wait(lock, [this] {
                    return !iq_queue.empty() || closed;
                });
                if (closed && iq_queue.empty()) break;
                iq_block = std::move(iq_queue.front());
                iq_queue.pop();
            }

            ++block_counter;
            if (block_counter < blocks_per_line) continue;
            block_counter = 0;

            std::vector<float> psd;
            try {
                fft.compute(iq_block, psd);
            } catch (const std::exception& e) {
                std::cerr << "[waterfall] FFT error: " << e.what() << '\n';
                continue;
            }

            std::lock_guard<std::mutex> lock(sub_mtx);
            for (auto& [id, cb] : subscribers) {
                cb(psd);
            }
        }
    }
};

WaterfallGenerator::WaterfallGenerator(Config config)
    : impl_(std::make_unique<Impl>(config))
{
}

WaterfallGenerator::~WaterfallGenerator()
{
    stop();
}

void WaterfallGenerator::start()
{
    impl_->running.store(true);
    impl_->worker = std::thread([this] { impl_->worker_loop(); });
}

void WaterfallGenerator::stop()
{
    impl_->running.store(false);
    {
        std::lock_guard<std::mutex> lock(impl_->queue_mtx);
        impl_->closed = true;
    }
    impl_->queue_cv.notify_all();
    if (impl_->worker.joinable()) {
        impl_->worker.join();
    }
}

void WaterfallGenerator::submit_iq_block(const std::vector<int16_t>& iq_payload)
{
    std::lock_guard<std::mutex> lock(impl_->queue_mtx);
    constexpr size_t MAX_QUEUE = 8;
    if (impl_->iq_queue.size() >= MAX_QUEUE) {
        impl_->iq_queue.pop();
    }
    impl_->iq_queue.push(iq_payload);
    impl_->queue_cv.notify_one();
}

uint32_t WaterfallGenerator::subscribe(WaterfallLineCallback callback)
{
    std::lock_guard<std::mutex> lock(impl_->sub_mtx);
    const uint32_t id = impl_->next_sub_id++;
    impl_->subscribers[id] = std::move(callback);
    return id;
}

void WaterfallGenerator::unsubscribe(uint32_t subscription_id)
{
    std::lock_guard<std::mutex> lock(impl_->sub_mtx);
    impl_->subscribers.erase(subscription_id);
}

} // namespace nextsdr
