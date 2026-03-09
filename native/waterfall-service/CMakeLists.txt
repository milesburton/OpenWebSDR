cmake_minimum_required(VERSION 3.20)
project(waterfall-service CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_compile_options(-Wall -Wextra -Wpedantic -fstack-protector-strong)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
  add_compile_options(-O3 -DNDEBUG)
else()
  add_compile_options(-g -O0 -fsanitize=address,undefined)
  add_link_options(-fsanitize=address,undefined)
endif()

add_subdirectory(../dsp-core dsp-core-build)

add_executable(waterfall-service
  src/waterfall_generator.cpp
  src/main.cpp
)

target_include_directories(waterfall-service
  PRIVATE include
)

target_link_libraries(waterfall-service
  PRIVATE dsp-core
)

install(TARGETS waterfall-service DESTINATION bin)
