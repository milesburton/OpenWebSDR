#include <gtest/gtest.h>
#include "dsp_core.h"

#include <cmath>
#include <vector>

using namespace nextsdr::dsp;

static constexpr float PI = 3.14159265358979323846f;
static constexpr float TWO_PI = 2.0f * PI;

TEST(FMDemodulatorTest, OutputHasCorrectSize)
{
    FMDemodulator demod(5000.0f, 48000.0f);
    std::vector<float> iq(256 * 2, 0.0f);
    std::vector<float> audio;

    demod.demodulate(iq, audio);

    EXPECT_EQ(audio.size(), static_cast<size_t>(256));
}

TEST(FMDemodulatorTest, ConstantPhaseProducesZeroOutput)
{
    // A pure CW carrier (no modulation) should produce constant output near zero
    FMDemodulator demod(5000.0f, 48000.0f);

    constexpr size_t N = 1024;
    std::vector<float> iq(N * 2);
    // Constant complex exponential at 1 kHz
    for (size_t i = 0; i < N; ++i) {
        const float phase = TWO_PI * 1000.0f * i / 48000.0f;
        iq[i * 2 + 0] = std::cos(phase);
        iq[i * 2 + 1] = std::sin(phase);
    }

    std::vector<float> audio;
    demod.demodulate(iq, audio);

    // After initial transient, output should be roughly constant
    // (we skip the first sample which depends on initial prev_sample)
    for (size_t i = 1; i < N; ++i) {
        EXPECT_NEAR(audio[i], audio[1], 1e-4f)
            << "FM demod of CW carrier should produce constant output";
    }
}

TEST(FMDemodulatorTest, FrequencyModulationProducesAudioSignal)
{
    // Generate a single-tone FM signal at 5 kHz deviation, 1 kHz modulation
    constexpr float SAMPLE_RATE = 48000.0f;
    constexpr float DEVIATION = 5000.0f;
    constexpr float MOD_FREQ = 1000.0f;
    constexpr float MOD_INDEX = DEVIATION / MOD_FREQ;
    constexpr size_t N = 4096;

    std::vector<float> iq(N * 2);
    for (size_t i = 0; i < N; ++i) {
        const float mod_phase = TWO_PI * MOD_FREQ * i / SAMPLE_RATE;
        const float phase = MOD_INDEX * std::sin(mod_phase);
        iq[i * 2 + 0] = std::cos(phase);
        iq[i * 2 + 1] = std::sin(phase);
    }

    FMDemodulator demod(DEVIATION, SAMPLE_RATE);
    std::vector<float> audio;
    demod.demodulate(iq, audio);

    // The demodulated output should oscillate (not be constant)
    float min_val = audio[0], max_val = audio[0];
    for (const float s : audio) {
        min_val = std::min(min_val, s);
        max_val = std::max(max_val, s);
    }

    EXPECT_GT(max_val - min_val, 0.1f)
        << "FM demodulation of modulated signal should produce varying output";
}
