/**
 * DSP core implementation.
 *
 * Provides:
 *   - FM demodulation
 *   - Channelisation (frequency shift + filter + decimate)
 *   - FFT-based power spectrum estimation
 *   - FIR filter design
 */

#include "dsp_core.h"

#include <algorithm>
#include <cassert>
#include <cmath>
#include <complex>
#include <numeric>
#include <stdexcept>

namespace nextsdr::dsp {

static constexpr float PI = 3.14159265358979323846f;
static constexpr float TWO_PI = 2.0f * PI;

// ---------------------------------------------------------------------------
// FMDemodulator
// ---------------------------------------------------------------------------

FMDemodulator::FMDemodulator(float deviation_hz, float sample_rate_hz)
    : gain_(sample_rate_hz / (TWO_PI * deviation_hz))
{
}

void FMDemodulator::demodulate(
    const std::vector<float>& iq_in,
    std::vector<float>& audio_out)
{
    const size_t n = iq_in.size() / 2;
    audio_out.resize(n);

    for (size_t i = 0; i < n; ++i) {
        const complex_f sample{iq_in[i * 2], iq_in[i * 2 + 1]};
        const complex_f product = sample * std::conj(prev_sample_);
        audio_out[i] = std::arg(product) * gain_;
        prev_sample_ = sample;
    }
}

// ---------------------------------------------------------------------------
// FIR filter design
// ---------------------------------------------------------------------------

static float bessel_i0(float x)
{
    // Modified Bessel function I0 via power series
    float sum = 1.0f;
    float term = 1.0f;
    const float half_x_sq = (x / 2.0f) * (x / 2.0f);
    for (int k = 1; k <= 20; ++k) {
        term *= half_x_sq / static_cast<float>(k * k);
        sum += term;
        if (term < 1e-10f * sum) break;
    }
    return sum;
}

std::vector<float> design_fir_lowpass(
    uint32_t num_taps,
    float cutoff_hz,
    float sample_rate_hz,
    float beta)
{
    if (num_taps % 2 == 0) ++num_taps; // Force odd length
    std::vector<float> taps(num_taps);

    const int M = static_cast<int>(num_taps) - 1;
    const float omega_c = TWO_PI * cutoff_hz / sample_rate_hz;
    const float i0_beta = bessel_i0(beta);

    for (int n = 0; n <= M; ++n) {
        const float t = static_cast<float>(n) - M / 2.0f;

        // Sinc function
        float sinc = (t == 0.0f)
            ? 1.0f
            : std::sin(omega_c * t) / (PI * t);

        // Kaiser window
        const float alpha = 2.0f * static_cast<float>(n) / M - 1.0f;
        const float arg = beta * std::sqrt(1.0f - alpha * alpha);
        const float window = bessel_i0(arg) / i0_beta;

        taps[n] = sinc * window;
    }

    // Normalise to unity DC gain
    const float gain = std::accumulate(taps.begin(), taps.end(), 0.0f);
    if (gain > 0.0f) {
        for (auto& t : taps) t /= gain;
    }

    return taps;
}

// ---------------------------------------------------------------------------
// Channeliser
// ---------------------------------------------------------------------------

Channeliser::Channeliser(Config config)
    : config_(config)
{
    if (config_.window_sample_rate_hz % config_.output_sample_rate_hz != 0) {
        throw std::invalid_argument(
            "output_sample_rate_hz must evenly divide window_sample_rate_hz");
    }

    decimation_factor_ = config_.window_sample_rate_hz / config_.output_sample_rate_hz;

    // FIR cutoff at half the channel bandwidth
    const float cutoff_hz =
        static_cast<float>(config_.channel_bandwidth_hz) / 2.0f;
    const uint32_t num_taps = 127;
    fir_taps_ = design_fir_lowpass(
        num_taps, cutoff_hz, static_cast<float>(config_.window_sample_rate_hz));

    delay_line_.assign(fir_taps_.size(), {0.0f, 0.0f});

    // Frequency shift: offset from window centre to channel centre
    const double freq_offset_hz =
        static_cast<double>(config_.channel_centre_hz) -
        static_cast<double>(config_.window_centre_hz);
    phase_increment_ =
        -TWO_PI * freq_offset_hz / config_.window_sample_rate_hz;
    phase_accumulator_ = 0.0;
}

void Channeliser::process(
    const std::vector<int16_t>& wide_iq_in,
    std::vector<float>& narrow_iq_out)
{
    const size_t n_in = wide_iq_in.size() / 2;
    const size_t n_out = n_in / decimation_factor_;
    narrow_iq_out.clear();
    narrow_iq_out.reserve(n_out * 2);

    constexpr float SCALE = 1.0f / 32768.0f;

    for (size_t i = 0; i < n_in; ++i) {
        // Convert CS16 → CF32
        const complex_f sample{
            static_cast<float>(wide_iq_in[i * 2]) * SCALE,
            static_cast<float>(wide_iq_in[i * 2 + 1]) * SCALE,
        };

        // Frequency shift
        const complex_f mixer{
            static_cast<float>(std::cos(phase_accumulator_)),
            static_cast<float>(std::sin(phase_accumulator_)),
        };
        const complex_f shifted = sample * mixer;
        phase_accumulator_ += phase_increment_;
        // Wrap phase to avoid precision loss
        if (phase_accumulator_ > PI) phase_accumulator_ -= TWO_PI;
        if (phase_accumulator_ < -PI) phase_accumulator_ += TWO_PI;

        // Shift delay line and FIR filter
        for (size_t k = delay_line_.size() - 1; k > 0; --k) {
            delay_line_[k] = delay_line_[k - 1];
        }
        delay_line_[0] = shifted;

        if (i % decimation_factor_ == 0) {
            complex_f acc{0.0f, 0.0f};
            for (size_t k = 0; k < fir_taps_.size(); ++k) {
                acc += delay_line_[k] * fir_taps_[k];
            }
            narrow_iq_out.push_back(acc.real());
            narrow_iq_out.push_back(acc.imag());
        }
    }
}

// ---------------------------------------------------------------------------
// FFTProcessor
// ---------------------------------------------------------------------------

FFTProcessor::FFTProcessor(uint32_t fft_size)
    : fft_size_(fft_size)
{
    // Build Hann window
    window_.resize(fft_size_);
    for (uint32_t i = 0; i < fft_size_; ++i) {
        window_[i] = 0.5f * (1.0f - std::cos(TWO_PI * i / (fft_size_ - 1)));
    }
}

void FFTProcessor::compute(
    const std::vector<int16_t>& iq_in,
    std::vector<float>& psd_out)
{
    if (iq_in.size() < fft_size_ * 2) {
        throw std::invalid_argument("iq_in too short for requested FFT size");
    }

    constexpr float SCALE = 1.0f / 32768.0f;

    // Apply window and convert to complex
    std::vector<complex_f> spectrum(fft_size_);
    for (uint32_t i = 0; i < fft_size_; ++i) {
        spectrum[i] = {
            static_cast<float>(iq_in[i * 2]) * SCALE * window_[i],
            static_cast<float>(iq_in[i * 2 + 1]) * SCALE * window_[i],
        };
    }

    fft_inplace(spectrum);

    // Compute power spectrum in dBFS
    psd_out.resize(fft_size_);
    const float norm = static_cast<float>(fft_size_);
    for (uint32_t i = 0; i < fft_size_; ++i) {
        // FFT shift: positive frequencies first
        const uint32_t idx = (i + fft_size_ / 2) % fft_size_;
        const float power =
            (spectrum[idx].real() * spectrum[idx].real() +
             spectrum[idx].imag() * spectrum[idx].imag()) /
            (norm * norm);
        psd_out[i] = 10.0f * std::log10(power + 1e-12f);
    }
}

void FFTProcessor::fft_inplace(std::vector<complex_f>& data)
{
    // Cooley-Tukey radix-2 DIT FFT (in-place)
    const size_t N = data.size();
    assert((N & (N - 1)) == 0); // Must be power of 2

    // Bit-reversal permutation
    for (size_t i = 1, j = 0; i < N; ++i) {
        size_t bit = N >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) std::swap(data[i], data[j]);
    }

    // Butterfly stages
    for (size_t len = 2; len <= N; len <<= 1) {
        const float angle = -TWO_PI / static_cast<float>(len);
        const complex_f wlen{std::cos(angle), std::sin(angle)};
        for (size_t i = 0; i < N; i += len) {
            complex_f w{1.0f, 0.0f};
            for (size_t j = 0; j < len / 2; ++j) {
                const complex_f u = data[i + j];
                const complex_f v = data[i + j + len / 2] * w;
                data[i + j] = u + v;
                data[i + j + len / 2] = u - v;
                w *= wlen;
            }
        }
    }
}

} // namespace nextsdr::dsp
