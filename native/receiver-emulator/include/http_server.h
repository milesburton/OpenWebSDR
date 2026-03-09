#pragma once

#include <functional>
#include <string>
#include <map>

namespace nextsdr {

/**
 * Minimal HTTP server interface for the receiver control contract.
 * Implemented using httplib.
 */

struct HttpRequest {
    std::string method;
    std::string path;
    std::string body;
    std::map<std::string, std::string> headers;
};

struct HttpResponse {
    int status{200};
    std::string body;
    std::string content_type{"application/json"};
};

using RouteHandler = std::function<HttpResponse(const HttpRequest&)>;

class HttpServer {
public:
    explicit HttpServer(const std::string& host, int port);
    ~HttpServer();

    void get(const std::string& path, RouteHandler handler);
    void post(const std::string& path, RouteHandler handler);
    void put(const std::string& path, RouteHandler handler);
    void del(const std::string& path, RouteHandler handler);

    /**
     * Start listening. Blocks until stop() is called.
     */
    void listen();

    /**
     * Stop the server.
     */
    void stop();

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace nextsdr
