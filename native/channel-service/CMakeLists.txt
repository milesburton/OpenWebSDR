cmake_minimum_required(VERSION 3.20)
project(channel-service CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_compile_options(-Wall -Wextra -Wpedantic -Wconversion -Wshadow -fstack-protector-strong)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
  add_compile_options(-O3 -march=native -DNDEBUG)
else()
  add_compile_options(-g -O0 -fsanitize=address,undefined)
  add_link_options(-fsanitize=address,undefined)
endif()

include(FetchContent)

FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG        v3.11.3
  GIT_SHALLOW    TRUE
)

FetchContent_Declare(
  cpp_httplib
  GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
  GIT_TAG        v0.15.3
  GIT_SHALLOW    TRUE
)

FetchContent_MakeAvailable(nlohmann_json cpp_httplib)

# DSP core
add_subdirectory(../dsp-core dsp-core-build)

add_library(channel-service-lib STATIC
  src/channel_worker.cpp
)

target_include_directories(channel-service-lib
  PUBLIC
    include
    ${cpp_httplib_SOURCE_DIR}
)

target_link_libraries(channel-service-lib
  PUBLIC
    dsp-core
    nlohmann_json::nlohmann_json
)

add_executable(channel-service
  src/main.cpp
)

target_link_libraries(channel-service
  PRIVATE channel-service-lib
)

install(TARGETS channel-service DESTINATION bin)
