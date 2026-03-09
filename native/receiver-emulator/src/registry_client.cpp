#include "registry_client.h"

#include <curl/curl.h>
#include <iostream>
#include <nlohmann/json.hpp>
#include <stdexcept>
#include <string>

namespace nextsdr {

namespace {

size_t write_callback(void* ptr, size_t size, size_t nmemb, std::string* out)
{
    out->append(static_cast<char*>(ptr), size * nmemb);
    return size * nmemb;
}

class CurlHandle {
public:
    CurlHandle()
        : handle_(curl_easy_init())
    {
        if (!handle_) throw std::runtime_error("Failed to initialise libcurl handle");
    }
    ~CurlHandle() { curl_easy_cleanup(handle_); }
    CURL* get() { return handle_; }

private:
    CURL* handle_;
};

std::string do_request(const std::string& url, const std::string& method, const std::string& body)
{
    CurlHandle curl;
    std::string response_body;

    curl_easy_setopt(curl.get(), CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl.get(), CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl.get(), CURLOPT_WRITEDATA, &response_body);
    curl_easy_setopt(curl.get(), CURLOPT_TIMEOUT, 10L);

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    curl_easy_setopt(curl.get(), CURLOPT_HTTPHEADER, headers);

    if (method == "POST") {
        curl_easy_setopt(curl.get(), CURLOPT_POST, 1L);
        curl_easy_setopt(curl.get(), CURLOPT_POSTFIELDS, body.c_str());
        curl_easy_setopt(curl.get(), CURLOPT_POSTFIELDSIZE, static_cast<long>(body.size()));
    } else if (method == "DELETE") {
        curl_easy_setopt(curl.get(), CURLOPT_CUSTOMREQUEST, "DELETE");
    }

    CURLcode res = curl_easy_perform(curl.get());
    curl_slist_free_all(headers);

    if (res != CURLE_OK) {
        throw std::runtime_error(
            std::string("libcurl error: ") + curl_easy_strerror(res));
    }

    long http_code = 0;
    curl_easy_getinfo(curl.get(), CURLINFO_RESPONSE_CODE, &http_code);
    if (http_code >= 400) {
        throw std::runtime_error(
            "HTTP " + std::to_string(http_code) + " from " + url);
    }

    return response_body;
}

} // namespace

RegistryClient::RegistryClient(std::string registry_url, std::string self_endpoint)
    : registry_url_(std::move(registry_url))
    , self_endpoint_(std::move(self_endpoint))
{
    curl_global_init(CURL_GLOBAL_DEFAULT);
}

std::string RegistryClient::register_self(
    uint64_t centre_frequency_hz,
    uint32_t sample_rate_hz)
{
    nlohmann::json body = {
        {"kind", "emulator"},
        {"site", "docker-local"},
        {"endpoint", self_endpoint_},
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

    const std::string url = registry_url_ + "/receivers/register";
    const std::string response = do_request(url, "POST", body.dump());

    auto json = nlohmann::json::parse(response);
    return json.at("receiverId").get<std::string>();
}

void RegistryClient::deregister(const std::string& receiver_id)
{
    const std::string url = registry_url_ + "/receivers/" + receiver_id;
    try {
        do_request(url, "DELETE", "");
    } catch (const std::exception& e) {
        std::cerr << "[registry-client] Deregister failed (ignoring): " << e.what() << '\n';
    }
}

bool RegistryClient::heartbeat(const std::string& receiver_id)
{
    const std::string url =
        registry_url_ + "/receivers/" + receiver_id + "/heartbeat";
    try {
        do_request(url, "POST", "{}");
        return true;
    } catch (const std::exception& e) {
        std::cerr << "[registry-client] Heartbeat failed: " << e.what() << '\n';
        return false;
    }
}

std::string RegistryClient::http_post(const std::string& path, const std::string& body)
{
    return do_request(registry_url_ + path, "POST", body);
}

std::string RegistryClient::http_delete(const std::string& path)
{
    return do_request(registry_url_ + path, "DELETE", "");
}

} // namespace nextsdr
