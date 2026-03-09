cmake_minimum_required(VERSION 3.20)
project(receiver-rtlsdr CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_compile_options(-Wall -Wextra -Wpedantic -fstack-protector-strong)

option(BUILD_RTLSDR "Build with real RTL-SDR hardware support" OFF)

if(BUILD_RTLSDR)
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(RTLSDR REQUIRED librtlsdr)
  add_compile_definitions(HAVE_RTLSDR)
endif()

add_executable(receiver-rtlsdr
  src/rtlsdr_receiver.cpp
  # src/main.cpp  -- will be added in Phase 4
)

target_include_directories(receiver-rtlsdr
  PRIVATE
    include
    ../receiver-emulator/include
)

if(BUILD_RTLSDR)
  target_include_directories(receiver-rtlsdr PRIVATE ${RTLSDR_INCLUDE_DIRS})
  target_link_libraries(receiver-rtlsdr PRIVATE ${RTLSDR_LIBRARIES})
endif()

install(TARGETS receiver-rtlsdr DESTINATION bin)
