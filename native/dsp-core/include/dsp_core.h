#pragma once

#include <complex>
#include <cstdint>
#include <vector>

namespace nextsdr::dsp {

using complex_f = std::complex<float>;

/**
 * FM demodulator.
 *
 * Implements frequency discriminator demodulation using atan2 of
 * the product of consecutive samples. Suitable for both FM and NFM.
 */
class FMDemodulator {
public:
    explicit FMDemodulator(float deviation_hz, float sample_rate_hz);

    /**
     * Demodulate a block of IQ samples.
     * @param iq_in  Input: interleaved float I, Q samples
     * @param audio_out Output: float audio samples in range [-1, 1]
     */
    void demodulate(
        const std::vector<float>& iq_in,
        std::vector<float>& audio_out);

private:
    float gain_;
    complex_f prev_sample_{1.0f, 0.0f};
};

/**
 * Channeliser — translates a narrowband channel from a wideband IQ stream.
 *
 * Steps:
 *   1. Frequency shift (mix down to baseband)
 *   2. Low-pass filter (Kaiser window FIR)
 *   3. Decimate to channel sample rate
 */
class Channeliser {
public:
    struct Config {
        uint64_t window_centre_hz;
        uint32_t window_sample_rate_hz;
        uint64_t channel_centre_hz;
        uint32_t channel_bandwidth_hz;
        uint32_t output_sample_rate_hz;
    };

    explicit Channeliser(Config config);

    /**
     * Process a block of wideband IQ samples (CS16 format, interleaved).
     * Outputs narrowband IQ samples (CF32 format, interleaved).
     */
    void process(
        const std::vector<int16_t>& wide_iq_in,
        std::vector<float>& narrow_iq_out);

private:
    Config config_;
    std::vector<float> fir_taps_;
    std::vector<complex_f> delay_line_;
    uint32_t decimation_factor_;
    double phase_accumulator_{0.0};
    double phase_increment_{0.0};
};

/**
 * FFT processor — generates power spectrum for waterfall display.
 */
class FFTProcessor {
public:
    explicit FFTProcessor(uint32_t fft_size);

    /**
     * Compute power spectrum from wideband IQ block.
     * @param iq_in   Input CS16 IQ samples (must have at least fft_size elements)
     * @param psd_out Output power in dBFS, fft_size bins
     */
    void compute(
        const std::vector<int16_t>& iq_in,
        std::vector<float>& psd_out);

private:
    uint32_t fft_size_;
    std::vector<float> window_; ///< Hann window coefficients

    static void fft_inplace(std::vector<complex_f>& data);
};

/**
 * Build a Kaiser-windowed FIR low-pass filter.
 * @param num_taps   Filter length (odd number recommended)
 * @param cutoff_hz  Cutoff frequency
 * @param sample_rate_hz Sample rate
 * @param beta       Kaiser window parameter (typical: 8.0 for -80 dB stopband)
 */
std::vector<float> design_fir_lowpass(
    uint32_t num_taps,
    float cutoff_hz,
    float sample_rate_hz,
    float beta = 8.0f);

} // namespace nextsdr::dsp
