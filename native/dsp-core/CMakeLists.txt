cmake_minimum_required(VERSION 3.20)
project(dsp-core CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_compile_options(
  -Wall -Wextra -Wpedantic -Wconversion -Wshadow
  -fstack-protector-strong
)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
  add_compile_options(-O3 -march=native -DNDEBUG)
else()
  add_compile_options(-g -O0 -fsanitize=address,undefined)
  add_link_options(-fsanitize=address,undefined)
endif()

add_library(dsp-core STATIC
  src/dsp_core.cpp
)

target_include_directories(dsp-core PUBLIC include)

# --- Tests ---
option(BUILD_TESTS "Build tests" ON)
if(BUILD_TESTS)
  enable_testing()

  include(FetchContent)
  FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG        v1.14.0
    GIT_SHALLOW    TRUE
  )
  set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
  FetchContent_MakeAvailable(googletest)

  add_executable(dsp-core-tests
    tests/fft_test.cpp
    tests/demod_test.cpp
    tests/fir_test.cpp
  )

  target_link_libraries(dsp-core-tests
    PRIVATE dsp-core GTest::gtest_main
  )

  include(GoogleTest)
  gtest_discover_tests(dsp-core-tests)
endif()
