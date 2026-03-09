#include <arpa/inet.h>
#include <atomic>
#include <csignal>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <map>
#include <memory>
#include <mutex>
#include <netinet/in.h>
#include <sys/socket.h>
#include <thread>
#include <unistd.h>

#define CPPHTTPLIB_OPENSSL_SUPPORT 0
#include <httplib.h>
#include <nlohmann/json.hpp>

#include "channel_worker.h"

static std::atomic<bool> g_shutdown{false};

static void signal_handler(int) { g_shutdown.store(true); }

static std::string env_or(const char* key, const char* fallback)
{
    const char* val = std::getenv(key);
    return val ? std::string(val) : std::string(fallback);
}

static int env_int(const char* key, int fallback)
{
    const char* val = std::getenv(key);
    if (!val) return fallback;
    return std::stoi(val);
}

struct WorkerEntry {
    std::string window_id;
    std::unique_ptr<nextsdr::ChannelWorker> worker;
};

static std::map<std::string, WorkerEntry> g_workers;
static std::mutex g_workers_mtx;

static void udp_receiver_loop(int udp_port)
{
    int sock = ::socket(AF_INET, SOCK_DGRAM, 0);
    if (sock < 0) {
        std::cerr << "[channel-service] Failed to create UDP socket\n";
        return;
    }

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(static_cast<uint16_t>(udp_port));
    addr.sin_addr.s_addr = INADDR_ANY;

    if (::bind(sock, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
        std::cerr << "[channel-service] Failed to bind UDP port " << udp_port << '\n';
        ::close(sock);
        return;
    }

    std::cout << "[channel-service] UDP IQ receiver on port " << udp_port << '\n';

    // Packet: 4-byte window_id length (uint32_t LE) + window_id bytes + int16_t IQ samples
    std::vector<uint8_t> buf(4 + 64 + 65536 * 4);

    while (!g_shutdown.load()) {
        struct timeval tv { 0, 100000 };
        fd_set fds;
        FD_ZERO(&fds);
        FD_SET(sock, &fds);
        int ready = ::select(sock + 1, &fds, nullptr, nullptr, &tv);
        if (ready <= 0) continue;

        ssize_t n = ::recv(sock, buf.data(), buf.size(), 0);
        if (n < 4) continue;

        uint32_t id_len = 0;
        std::memcpy(&id_len, buf.data(), 4);
        if (static_cast<ssize_t>(4 + id_len) > n) continue;

        std::string window_id(reinterpret_cast<char*>(buf.data() + 4), id_len);
        size_t payload_offset = 4 + id_len;
        size_t payload_bytes = static_cast<size_t>(n) - payload_offset;
        if (payload_bytes == 0 || payload_bytes % 2 != 0) continue;

        size_t sample_count = payload_bytes / sizeof(int16_t);
        std::vector<int16_t> iq(sample_count);
        std::memcpy(iq.data(), buf.data() + payload_offset, payload_bytes);

        std::lock_guard<std::mutex> lock(g_workers_mtx);
        for (auto& [channel_id, entry] : g_workers) {
            if (entry.window_id == window_id && entry.worker->is_active()) {
                entry.worker->submit_iq_block(iq);
            }
        }
    }

    ::close(sock);
}

int main()
{
    std::signal(SIGTERM, signal_handler);
    std::signal(SIGINT, signal_handler);

    const int http_port = env_int("PORT", 9100);
    const std::string http_host = env_or("HOST", "0.0.0.0");
    const int udp_port = env_int("IQ_UDP_PORT", 5005);

    std::cout << "[channel-service] Starting (HTTP:" << http_port
              << " UDP:" << udp_port << ")\n";

    httplib::Server http;

    http.Post("/channels", [](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = nlohmann::json::parse(req.body);
            auto def = body.at("definition");

            nextsdr::ChannelWorker::Config cfg;
            cfg.channel_id            = body.at("channelId").get<std::string>();
            cfg.window_id             = body.at("windowId").get<std::string>();
            cfg.window_centre_hz      = def.at("windowCentreHz").get<uint64_t>();
            cfg.window_sample_rate_hz = def.at("windowSampleRateHz").get<uint32_t>();
            cfg.channel_centre_hz     = def.at("frequencyHz").get<uint64_t>();
            cfg.channel_bandwidth_hz  = def.at("bandwidthHz").get<uint32_t>();
            cfg.audio_sample_rate_hz  = def.value("audioSampleRateHz", 48000u);
            cfg.demod_mode            = def.value("mode", std::string{"NFM"});
            cfg.deviation_hz          = def.value("deviationHz", 5000.0f);

            auto worker = std::make_unique<nextsdr::ChannelWorker>(cfg);
            worker->start([](const std::vector<float>&) {});

            {
                std::lock_guard<std::mutex> lock(g_workers_mtx);
                g_workers[cfg.channel_id] = { cfg.window_id, std::move(worker) };
            }

            nlohmann::json resp = { {"channelId", cfg.channel_id}, {"started", true} };
            res.set_content(resp.dump(), "application/json");
            res.status = 201;
        } catch (const std::exception& e) {
            res.status = 400;
            res.set_content(nlohmann::json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    http.Delete(R"(/channels/([^/]+))", [](const httplib::Request& req, httplib::Response& res) {
        const std::string channel_id = req.matches[1];
        std::lock_guard<std::mutex> lock(g_workers_mtx);
        auto it = g_workers.find(channel_id);
        if (it == g_workers.end()) {
            res.status = 404;
            res.set_content(R"({"error":"not found"})", "application/json");
            return;
        }
        it->second.worker->stop();
        g_workers.erase(it);
        res.status = 204;
    });

    http.Get("/channels", [](const httplib::Request&, httplib::Response& res) {
        nlohmann::json list = nlohmann::json::array();
        std::lock_guard<std::mutex> lock(g_workers_mtx);
        for (const auto& [id, entry] : g_workers) {
            list.push_back({
                {"channelId", id},
                {"windowId", entry.window_id},
                {"active", entry.worker->is_active()},
                {"listeners", entry.worker->listener_count()},
            });
        }
        res.set_content(nlohmann::json{{"channels", list}}.dump(), "application/json");
    });

    http.Get("/healthz/live", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(R"({"alive":true})", "application/json");
    });

    std::thread udp_thread(udp_receiver_loop, udp_port);
    std::thread http_thread([&]() {
        if (!http.listen(http_host.c_str(), http_port)) {
            std::cerr << "[channel-service] HTTP listen failed\n";
        }
    });

    while (!g_shutdown.load()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    std::cout << "[channel-service] Shutting down\n";
    http.stop();

    {
        std::lock_guard<std::mutex> lock(g_workers_mtx);
        for (auto& [id, entry] : g_workers) {
            entry.worker->stop();
        }
        g_workers.clear();
    }

    if (udp_thread.joinable()) udp_thread.join();
    if (http_thread.joinable()) http_thread.join();

    return 0;
}
