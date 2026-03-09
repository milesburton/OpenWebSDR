#include "http_server.h"

#include <httplib.h>

#include <iostream>
#include <stdexcept>

namespace nextsdr {

struct HttpServer::Impl {
    httplib::Server server;
    std::string host;
    int port;
};

HttpServer::HttpServer(const std::string& host, int port)
    : impl_(std::make_unique<Impl>())
{
    impl_->host = host;
    impl_->port = port;
}

HttpServer::~HttpServer()
{
    stop();
}

void HttpServer::get(const std::string& path, RouteHandler handler)
{
    impl_->server.Get(path.c_str(), [h = std::move(handler)](
                                        const httplib::Request& req,
                                        httplib::Response& res) {
        HttpRequest in;
        in.method = "GET";
        in.path = req.path;
        in.body = req.body;
        for (const auto& [k, v] : req.headers) {
            in.headers[k] = v;
        }
        HttpResponse out = h(in);
        res.status = out.status;
        res.set_content(out.body, out.content_type.c_str());
    });
}

void HttpServer::post(const std::string& path, RouteHandler handler)
{
    impl_->server.Post(path.c_str(), [h = std::move(handler)](
                                         const httplib::Request& req,
                                         httplib::Response& res) {
        HttpRequest in;
        in.method = "POST";
        in.path = req.path;
        in.body = req.body;
        HttpResponse out = h(in);
        res.status = out.status;
        res.set_content(out.body, out.content_type.c_str());
    });
}

void HttpServer::put(const std::string& path, RouteHandler handler)
{
    impl_->server.Put(path.c_str(), [h = std::move(handler)](
                                        const httplib::Request& req,
                                        httplib::Response& res) {
        HttpRequest in;
        in.method = "PUT";
        in.path = req.path;
        in.body = req.body;
        HttpResponse out = h(in);
        res.status = out.status;
        res.set_content(out.body, out.content_type.c_str());
    });
}

void HttpServer::del(const std::string& path, RouteHandler handler)
{
    impl_->server.Delete(path.c_str(), [h = std::move(handler)](
                                           const httplib::Request& req,
                                           httplib::Response& res) {
        HttpRequest in;
        in.method = "DELETE";
        in.path = req.path;
        in.body = req.body;
        HttpResponse out = h(in);
        res.status = out.status;
        res.set_content(out.body, out.content_type.c_str());
    });
}

void HttpServer::listen()
{
    std::cout << "[http-server] Listening on " << impl_->host << ":" << impl_->port << '\n';
    if (!impl_->server.listen(impl_->host.c_str(), impl_->port)) {
        throw std::runtime_error(
            "Failed to listen on " + impl_->host + ":" + std::to_string(impl_->port));
    }
}

void HttpServer::stop()
{
    impl_->server.stop();
}

} // namespace nextsdr
