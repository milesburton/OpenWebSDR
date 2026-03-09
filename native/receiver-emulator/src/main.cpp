/**
 * receiver-emulator entry point.
 *
 * Starts the emulator, registers with the receiver-registry,
 * and exposes the receiver control contract over HTTP.
 */

#include "emulator.h"
#include "http_server.h"
#include "registry_client.h"

#include <atomic>
#include <chrono>
#include <csignal>
#include <cstdlib>
#include <iostream>
#include <nlohmann/json.hpp>
#include <stdexcept>
#include <string>
#include <thread>

static std::atomic<bool> g_shutdown{false};

static void signal_handler(int /*sig*/) { g_shutdown.store(true); }

static std::string env_or(const char* key, const char* fallback)
{
    const char* val = std::getenv(key);
    return val ? std::string(val) : std::string(fallback);
}

static uint64_t env_uint64(const char* key, uint64_t fallback)
{
    const char* val = std::getenv(key);
    if (!val) return fallback;
    return static_cast<uint64_t>(std::stoull(val));
}

int main()
{
    std::signal(SIGTERM, signal_handler);
    std::signal(SIGINT, signal_handler);

    const std::string registry_url = env_or("REGISTRY_URL", "http://receiver-registry:3001");
    const std::string self_host = env_or("HOST", "0.0.0.0");
    const int self_port = std::stoi(env_or("PORT", "8080"));
    const std::string self_endpoint =
        "http://" + env_or("SELF_HOST", "receiver-emulator") + ":" + std::to_string(self_port);
    const uint64_t centre_freq_hz = env_uint64("CENTRE_FREQUENCY_HZ", 145'000'000);
    const uint32_t sample_rate_hz =
        static_cast<uint32_t>(env_uint64("SAMPLE_RATE_HZ", 2'048'000));
    const std::string scenario_id = env_or("SCENARIO_ID", "single-fm");

    std::cout << "[emulator] Starting receiver-emulator\n";
    std::cout << "[emulator] Registry: " << registry_url << '\n';
    std::cout << "[emulator] Self endpoint: " << self_endpoint << '\n';
    std::cout << "[emulator] Centre frequency: " << centre_freq_hz << " Hz\n";
    std::cout << "[emulator] Sample rate: " << sample_rate_hz << " Hz\n";
    std::cout << "[emulator] Scenario: " << scenario_id << '\n';

    // --- Build signal scene ---
    nextsdr::EmulatorConfig config;
    config.centre_frequency_hz = centre_freq_hz;
    config.sample_rate_hz = sample_rate_hz;

    // Always add noise floor
    config.signals.push_back({
        nextsdr::SyntheticSignal::Type::NOISE,
        0.0,
        -80.0,
    });

    // Add scenario-specific signals
    if (scenario_id == "single-fm" || scenario_id == "block-drops") {
        config.signals.push_back({
            nextsdr::SyntheticSignal::Type::NFM,
            145'500'000.0,
            -40.0,
            5000.0,
            1000.0,
        });
        if (scenario_id == "block-drops") {
            config.faults.drop_probability = 0.05;
        }
    } else if (scenario_id == "dual-fm") {
        config.signals.push_back({
            nextsdr::SyntheticSignal::Type::NFM,
            144'800'000.0,
            -40.0,
            5000.0,
            800.0,
        });
        config.signals.push_back({
            nextsdr::SyntheticSignal::Type::NFM,
            145'500'000.0,
            -45.0,
            5000.0,
            1200.0,
        });
    } else if (scenario_id == "stream-stall") {
        config.faults.stall_probability = 0.1;
        config.faults.stall_duration_ms = 500;
    } else if (scenario_id == "disconnect") {
        config.faults.disconnect_after_seconds = 10;
    }

    // --- Register with registry ---
    nextsdr::RegistryClient registry(registry_url, self_endpoint);
    std::string receiver_id;

    for (int attempt = 1; attempt <= 10; ++attempt) {
        try {
            receiver_id = registry.register_self(centre_freq_hz, sample_rate_hz);
            std::cout << "[emulator] Registered with id: " << receiver_id << '\n';
            break;
        } catch (const std::exception& e) {
            std::cerr << "[emulator] Registration attempt " << attempt
                      << " failed: " << e.what() << '\n';
            if (attempt == 10) {
                std::cerr << "[emulator] Giving up after 10 registration attempts\n";
                return 1;
            }
            std::this_thread::sleep_for(std::chrono::seconds(3));
        }
    }

    config.receiver_id = receiver_id;
    config.window_id = "";

    // --- Heartbeat thread ---
    std::thread heartbeat_thread([&]() {
        while (!g_shutdown.load()) {
            std::this_thread::sleep_for(std::chrono::seconds(5));
            registry.heartbeat(receiver_id);
        }
    });

    // --- Start emulator (will stream once window is configured) ---
    std::unique_ptr<nextsdr::ReceiverEmulator> emulator;
    std::atomic<bool> streaming{false};

    // --- HTTP control server ---
    nextsdr::HttpServer server(self_host, self_port);

    server.get("/healthz/live", [](const nextsdr::HttpRequest&) {
        return nextsdr::HttpResponse{200, R"({"alive":true})"};
    });

    server.get("/healthz/ready", [](const nextsdr::HttpRequest&) {
        return nextsdr::HttpResponse{200, R"({"ready":true})"};
    });

    server.get("/receivers", [&](const nextsdr::HttpRequest&) {
        nlohmann::json resp = {
            {"receivers", {{
                {"id", receiver_id},
                {"kind", "emulator"},
                {"capabilities", {
                    {"minFrequencyHz", 144'000'000},
                    {"maxFrequencyHz", 146'000'000},
                    {"supportedSampleRates", {1'024'000, 2'048'000}},
                    {"gainModes", {"auto"}},
                    {"nominalBandwidthHz", sample_rate_hz},
                    {"maxConcurrentWindows", 1},
                    {"backendType", "emulator"}
                }}
            }}}
        };
        return nextsdr::HttpResponse{200, resp.dump()};
    });

    server.post("/receivers/" + receiver_id + "/claim",
        [](const nextsdr::HttpRequest&) {
            return nextsdr::HttpResponse{200, R"({"success":true})"};
        });

    server.post("/receivers/" + receiver_id + "/release",
        [&](const nextsdr::HttpRequest&) {
            if (emulator && emulator->is_running()) {
                emulator->stop();
                streaming.store(false);
            }
            return nextsdr::HttpResponse{200, R"({"success":true})"};
        });

    server.get("/receivers/" + receiver_id + "/capabilities",
        [&](const nextsdr::HttpRequest&) {
            nlohmann::json caps = {
                {"capabilities", {
                    {"minFrequencyHz", 144'000'000},
                    {"maxFrequencyHz", 146'000'000},
                    {"supportedSampleRates", {1'024'000, 2'048'000}},
                    {"gainModes", {"auto"}},
                    {"nominalBandwidthHz", sample_rate_hz},
                    {"maxConcurrentWindows", 1},
                    {"backendType", "emulator"}
                }}
            };
            return nextsdr::HttpResponse{200, caps.dump()};
        });

    server.put("/receivers/" + receiver_id + "/window",
        [&](const nextsdr::HttpRequest& req) {
            try {
                auto body = nlohmann::json::parse(req.body);
                config.centre_frequency_hz = body.value("centreFrequencyHz", centre_freq_hz);
                config.sample_rate_hz = body.value("sampleRateHz", sample_rate_hz);
                nlohmann::json applied = {
                    {"success", true},
                    {"appliedConfig", {
                        {"centreFrequencyHz", config.centre_frequency_hz},
                        {"sampleRateHz", config.sample_rate_hz}
                    }}
                };
                return nextsdr::HttpResponse{200, applied.dump()};
            } catch (...) {
                return nextsdr::HttpResponse{400, R"({"success":false,"reason":"invalid body"})"};
            }
        });

    server.post("/receivers/" + receiver_id + "/stream/start",
        [&](const nextsdr::HttpRequest& req) {
            if (streaming.load()) {
                return nextsdr::HttpResponse{
                    409, R"({"success":false,"reason":"already streaming"})"};
            }
            try {
                auto body = nlohmann::json::parse(req.body);
                config.window_id = body.value("windowId", std::string{});
            } catch (...) {}

            emulator = std::make_unique<nextsdr::ReceiverEmulator>(config);
            emulator->start([](const nextsdr::IQBlock& block) {
                // In production, IQ blocks are forwarded to channel-service via UDP/ZMQ.
                // For the skeleton, we count blocks and log periodically.
                static uint64_t count = 0;
                if (++count % 50 == 0) {
                    std::cout << "[emulator] Block " << block.sequence_number
                              << " dropped=" << block.dropped
                              << " corrupt=" << block.corrupt
                              << " eos=" << block.end_of_stream << '\n';
                }
            });
            streaming.store(true);

            nlohmann::json resp = {
                {"success", true},
                {"streamEndpoint", "udp://" + env_or("SELF_HOST", "receiver-emulator") + ":5005"}
            };
            return nextsdr::HttpResponse{200, resp.dump()};
        });

    server.post("/receivers/" + receiver_id + "/stream/stop",
        [&](const nextsdr::HttpRequest&) {
            if (emulator && emulator->is_running()) {
                emulator->stop();
                streaming.store(false);
            }
            return nextsdr::HttpResponse{200, R"({"success":true})"};
        });

    server.get("/receivers/" + receiver_id + "/health",
        [](const nextsdr::HttpRequest&) {
            nlohmann::json resp = {
                {"health", {
                    {"status", "healthy"},
                    {"lastCheckedAt", "2024-01-01T00:00:00Z"}
                }}
            };
            return nextsdr::HttpResponse{200, resp.dump()};
        });

    // --- Main loop: listen until shutdown ---
    std::thread server_thread([&]() { server.listen(); });

    while (!g_shutdown.load()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    std::cout << "[emulator] Shutting down\n";
    registry.deregister(receiver_id);
    if (emulator) emulator->stop();
    server.stop();

    if (server_thread.joinable()) server_thread.join();
    heartbeat_thread.join();

    return 0;
}
