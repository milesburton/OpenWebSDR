cmake_minimum_required(VERSION 3.20)
project(receiver-emulator CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler hardening flags
add_compile_options(
  -Wall
  -Wextra
  -Wpedantic
  -Wconversion
  -Wshadow
  -fstack-protector-strong
  -D_FORTIFY_SOURCE=2
)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
  add_compile_options(-O2 -DNDEBUG)
else()
  add_compile_options(-g -O0 -fsanitize=address,undefined)
  add_link_options(-fsanitize=address,undefined)
endif()

# Dependencies via FetchContent
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

# Find libcurl
find_package(CURL REQUIRED)

# --- Library (for testing) ---
add_library(emulator-lib STATIC
  src/emulator.cpp
  src/registry_client.cpp
  src/http_server.cpp
)

target_include_directories(emulator-lib
  PUBLIC
    include
    ${cpp_httplib_SOURCE_DIR}
)

target_link_libraries(emulator-lib
  PUBLIC
    nlohmann_json::nlohmann_json
    CURL::libcurl
)

# --- Main executable ---
add_executable(receiver-emulator
  src/main.cpp
)

target_link_libraries(receiver-emulator
  PRIVATE
    emulator-lib
)

# --- Tests ---
option(BUILD_TESTS "Build tests" ON)

if(BUILD_TESTS)
  enable_testing()

  FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG        v1.14.0
    GIT_SHALLOW    TRUE
  )
  set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
  FetchContent_MakeAvailable(googletest)

  add_executable(emulator-tests
    tests/emulator_test.cpp
    tests/fault_injection_test.cpp
  )

  target_link_libraries(emulator-tests
    PRIVATE
      emulator-lib
      GTest::gtest_main
  )

  include(GoogleTest)
  gtest_discover_tests(emulator-tests)
endif()

# --- Installation ---
install(TARGETS receiver-emulator DESTINATION bin)
