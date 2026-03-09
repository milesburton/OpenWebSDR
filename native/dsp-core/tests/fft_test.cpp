#include <gtest/gtest.h>
#include "dsp_core.h"

#include <cmath>
#include <vector>

using namespace nextsdr::dsp;

static constexpr float PI = 3.14159265358979323846f;
static constexpr float TWO_PI = 2.0f * PI;

TEST(FFTProcessorTest, OutputHasCorrectBinCount)
{
    FFTProcessor processor(1024);
    std::vector<int16_t> iq(1024 * 2, 0);
    std::vector<float> psd;

    processor.compute(iq, psd);

    EXPECT_EQ(psd.size(), static_cast<size_t>(1024));
}

TEST(FFTProcessorTest, NullInputProducesVeryLowPower)
{
    FFTProcessor processor(1024);
    std::vector<int16_t> iq(1024 * 2, 0);
    std::vector<float> psd;

    processor.compute(iq, psd);

    for (float bin : psd) {
        EXPECT_LT(bin, -100.0f) << "Expected very low power for null input";
    }
}

TEST(FFTProcessorTest, PureToneProducesPeakAtCorrectBin)
{
    constexpr uint32_t FFT_SIZE = 1024;
    constexpr float SAMPLE_RATE = 2'048'000.0f;
    // Tone at 1/8 of sample rate → bin FFT_SIZE/8 (after FFT shift: FFT_SIZE/2 + FFT_SIZE/8)
    constexpr float TONE_FREQ = SAMPLE_RATE / 8.0f;
    constexpr uint32_t EXPECTED_BIN = FFT_SIZE / 2 + FFT_SIZE / 8;

    std::vector<int16_t> iq(FFT_SIZE * 2);
    for (uint32_t i = 0; i < FFT_SIZE; ++i) {
        const float phase = TWO_PI * TONE_FREQ * i / SAMPLE_RATE;
        iq[i * 2 + 0] = static_cast<int16_t>(20000.0f * std::cos(phase));
        iq[i * 2 + 1] = static_cast<int16_t>(20000.0f * std::sin(phase));
    }

    FFTProcessor processor(FFT_SIZE);
    std::vector<float> psd;
    processor.compute(iq, psd);

    // Find peak bin
    uint32_t peak_bin = 0;
    float peak_power = psd[0];
    for (uint32_t b = 1; b < FFT_SIZE; ++b) {
        if (psd[b] > peak_power) {
            peak_power = psd[b];
            peak_bin = b;
        }
    }

    // Allow ±2 bins for leakage
    EXPECT_NEAR(static_cast<int>(peak_bin), static_cast<int>(EXPECTED_BIN), 2)
        << "Peak at bin " << peak_bin << ", expected ~" << EXPECTED_BIN;
}

TEST(FFTProcessorTest, OutputIsNegativeDbfs)
{
    constexpr uint32_t FFT_SIZE = 1024;
    // Generate a moderate-amplitude sine
    std::vector<int16_t> iq(FFT_SIZE * 2);
    for (uint32_t i = 0; i < FFT_SIZE; ++i) {
        const float phase = 2.0f * PI * 0.1f * i;
        iq[i * 2 + 0] = static_cast<int16_t>(16000.0f * std::cos(phase));
        iq[i * 2 + 1] = static_cast<int16_t>(16000.0f * std::sin(phase));
    }

    FFTProcessor processor(FFT_SIZE);
    std::vector<float> psd;
    processor.compute(iq, psd);

    // All output values should be dBFS ≤ 0
    for (float bin : psd) {
        EXPECT_LE(bin, 0.0f) << "Power in dBFS should be ≤ 0";
    }
}
