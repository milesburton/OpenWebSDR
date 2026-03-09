#pragma once

#include <cstdint>
#include <string>

namespace nextsdr {

/**
 * Client for registering with the receiver-registry service.
 */
class RegistryClient {
public:
    RegistryClient(std::string registry_url, std::string self_endpoint);

    /**
     * Register this emulator with the registry.
     * Returns the assigned receiver ID.
     * Throws on failure.
     */
    std::string register_self(
        uint64_t centre_frequency_hz,
        uint32_t sample_rate_hz);

    /**
     * Deregister from the registry.
     */
    void deregister(const std::string& receiver_id);

    /**
     * Send a heartbeat to keep registration alive.
     */
    bool heartbeat(const std::string& receiver_id);

private:
    std::string registry_url_;
    std::string self_endpoint_;

    std::string http_post(const std::string& path, const std::string& body);
    std::string http_delete(const std::string& path);
};

} // namespace nextsdr
