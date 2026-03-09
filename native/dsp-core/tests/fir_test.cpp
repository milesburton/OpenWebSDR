#include <gtest/gtest.h>
#include "dsp_core.h"

#include <cmath>
#include <numeric>

using namespace nextsdr::dsp;

TEST(FIRTest, HasCorrectLength)
{
    auto taps = design_fir_lowpass(63, 5000.0f, 48000.0f);
    EXPECT_EQ(taps.size(), static_cast<size_t>(63));
}

TEST(FIRTest, DCGainIsApproximatelyUnity)
{
    auto taps = design_fir_lowpass(127, 5000.0f, 48000.0f);
    const float dc_gain = std::accumulate(taps.begin(), taps.end(), 0.0f);
    EXPECT_NEAR(dc_gain, 1.0f, 0.001f)
        << "FIR low-pass filter should have unity DC gain";
}

TEST(FIRTest, CoefficientsAreSymmetric)
{
    auto taps = design_fir_lowpass(63, 5000.0f, 48000.0f);
    const size_t N = taps.size();
    for (size_t i = 0; i < N / 2; ++i) {
        EXPECT_NEAR(taps[i], taps[N - 1 - i], 1e-6f)
            << "FIR filter should be symmetric at index " << i;
    }
}

TEST(FIRTest, EvenLengthIsRoundedToOdd)
{
    // Pass even number — design_fir_lowpass should round up to odd
    auto taps = design_fir_lowpass(64, 5000.0f, 48000.0f);
    EXPECT_EQ(taps.size() % 2, static_cast<size_t>(1)) << "Tap count should be odd";
}
