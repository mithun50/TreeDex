"""
Generate ambient background music for TreeDex promo video.
Minimal electronic drone — dark, techy, cinematic.
60 seconds at 22050 Hz mono WAV.
"""
import struct
import math
import os

SAMPLE_RATE = 22050
DURATION = 62  # slightly longer than video to avoid cutoff
NUM_SAMPLES = SAMPLE_RATE * DURATION

def write_wav(filename, samples, sample_rate=22050):
    """Write 16-bit mono WAV file."""
    num = len(samples)
    with open(filename, 'wb') as f:
        # Header
        f.write(b'RIFF')
        data_size = num * 2
        f.write(struct.pack('<I', 36 + data_size))
        f.write(b'WAVE')
        # fmt
        f.write(b'fmt ')
        f.write(struct.pack('<I', 16))  # chunk size
        f.write(struct.pack('<H', 1))   # PCM
        f.write(struct.pack('<H', 1))   # mono
        f.write(struct.pack('<I', sample_rate))
        f.write(struct.pack('<I', sample_rate * 2))  # byte rate
        f.write(struct.pack('<H', 2))   # block align
        f.write(struct.pack('<H', 16))  # bits per sample
        # data
        f.write(b'data')
        f.write(struct.pack('<I', data_size))
        for s in samples:
            clamped = max(-1.0, min(1.0, s))
            f.write(struct.pack('<h', int(clamped * 32767)))

def generate_bgm():
    samples = []

    # Base frequencies (minor chord drone)
    f_root = 55.0      # A1
    f_fifth = 82.41    # E2
    f_octave = 110.0   # A2
    f_minor = 65.41    # C2 (minor third)

    for i in range(NUM_SAMPLES):
        t = i / SAMPLE_RATE

        # Fade envelope
        fade_in = min(t / 4.0, 1.0)  # 4s fade in
        fade_out = min((DURATION - t) / 3.0, 1.0)  # 3s fade out
        envelope = fade_in * fade_out

        # Slow LFO for movement
        lfo1 = 0.5 + 0.5 * math.sin(2 * math.pi * 0.07 * t)
        lfo2 = 0.5 + 0.5 * math.sin(2 * math.pi * 0.11 * t + 1.3)
        lfo3 = 0.5 + 0.5 * math.sin(2 * math.pi * 0.05 * t + 2.7)

        # Oscillators — low sine drones
        osc1 = math.sin(2 * math.pi * f_root * t) * 0.25
        osc2 = math.sin(2 * math.pi * f_fifth * t) * 0.15 * lfo1
        osc3 = math.sin(2 * math.pi * f_octave * t) * 0.10 * lfo2
        osc4 = math.sin(2 * math.pi * f_minor * t) * 0.08 * lfo3

        # Sub bass (very low)
        sub = math.sin(2 * math.pi * 27.5 * t) * 0.12

        # High shimmer (subtle high frequency)
        shimmer_freq = 440 + 100 * math.sin(2 * math.pi * 0.03 * t)
        shimmer = math.sin(2 * math.pi * shimmer_freq * t) * 0.02 * lfo2

        # Pad (filtered saw approximation — sum of harmonics)
        pad = 0
        for h in range(1, 6):
            pad += math.sin(2 * math.pi * f_octave * h * t) / (h * h) * 0.04
        pad *= lfo3

        # Combine
        sample = (osc1 + osc2 + osc3 + osc4 + sub + shimmer + pad) * envelope

        # Soft clip for warmth
        sample = math.tanh(sample * 1.5) * 0.6

        samples.append(sample)

    return samples

print("Generating ambient background music...")
samples = generate_bgm()
outpath = os.path.join("public", "audio", "bgm_ambient.wav")
write_wav(outpath, samples, SAMPLE_RATE)
size = os.path.getsize(outpath)
print(f"Saved: {outpath} ({size} bytes, {DURATION}s)")
