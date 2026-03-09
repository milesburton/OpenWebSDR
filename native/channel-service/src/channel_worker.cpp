#include "channel_worker.h"

#include <condition_variable>
#include <iostream>
#include <mutex>
#include <queue>
#include <stdexcept>

#include "../../dsp-core/include/dsp_core.h"

namespace nextsdr {

struct ChannelWorker::IQQueue {
    std::queue<std::vector<int16_t>> queue;
    std::mutex mtx;
    std::condition_variable cv;
    bool closed{false};
    static constexpr size_t MAX_DEPTH = 16;
};

ChannelWorker::ChannelWorker(Config config)
    : config_(std::move(config))
    , queue_(std::make_unique<IQQueue>())
{
}

ChannelWorker::~ChannelWorker()
{
    stop();
}

void ChannelWorker::start(AudioCallback audio_callback)
{
    if (active_.exchange(true, std::memory_order_acq_rel)) {
        throw std::runtime_error("ChannelWorker already started");
    }

    worker_thread_ = std::thread(
        [this, cb = std::move(audio_callback)]() mutable {
            process_loop(std::move(cb));
        });
}

void ChannelWorker::stop()
{
    active_.store(false, std::memory_order_release);
    {
        std::lock_guard<std::mutex> lock(queue_->mtx);
        queue_->closed = true;
    }
    queue_->cv.notify_all();
    if (worker_thread_.joinable()) {
        worker_thread_.join();
    }
}

void ChannelWorker::submit_iq_block(const std::vector<int16_t>& iq_payload)
{
    std::lock_guard<std::mutex> lock(queue_->mtx);
    if (queue_->queue.size() >= IQQueue::MAX_DEPTH) {
        // Drop oldest block to avoid unbounded growth
        queue_->queue.pop();
        std::cerr << "[channel-worker:" << config_.channel_id
                  << "] Queue overflow — dropping oldest block\n";
    }
    queue_->queue.push(iq_payload);
    queue_->cv.notify_one();
}

void ChannelWorker::remove_listener()
{
    int prev = listener_count_.fetch_sub(1);
    if (prev <= 0) listener_count_.store(0);
}

void ChannelWorker::process_loop(AudioCallback callback)
{
    // Initialise DSP components
    dsp::Channeliser channeliser({
        config_.window_centre_hz,
        config_.window_sample_rate_hz,
        config_.channel_centre_hz,
        config_.channel_bandwidth_hz,
        config_.audio_sample_rate_hz,
    });

    dsp::FMDemodulator demodulator(
        config_.deviation_hz,
        static_cast<float>(config_.audio_sample_rate_hz));

    std::cout << "[channel-worker:" << config_.channel_id << "] Started\n";

    while (true) {
        std::vector<int16_t> iq_block;
        {
            std::unique_lock<std::mutex> lock(queue_->mtx);
            queue_->cv.wait(lock, [this] {
                return !queue_->queue.empty() || queue_->closed;
            });

            if (queue_->closed && queue_->queue.empty()) break;
            iq_block = std::move(queue_->queue.front());
            queue_->queue.pop();
        }

        std::vector<float> narrow_iq;
        channeliser.process(iq_block, narrow_iq);

        std::vector<float> audio;
        if (config_.demod_mode == "NFM" || config_.demod_mode == "FM") {
            demodulator.demodulate(narrow_iq, audio);
        } else {
            audio.assign(narrow_iq.size() / 2, 0.0f);
        }

        callback(audio);
    }

    std::cout << "[channel-worker:" << config_.channel_id << "] Stopped\n";
}

} // namespace nextsdr
