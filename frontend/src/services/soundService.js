/**
 * Web Audio Synthesizer Service
 * Lightweight, zero-dependency procedural audio & soundscapes.
 * Uses native Web Audio API oscillators, buffers, and gain nodes.
 */

const STORAGE_KEY = 'openprep_sound_settings';

class SoundService {
  constructor() {
    this.audioCtx = null;
    this.ambientSource = null;
    this.ambientGain = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.listeners = new Set();

    this.settings = this.loadSettings();
  }

  loadSettings() {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return {
            isMuted: false,
            masterVolume: 0.7,
            sfxVolume: 0.8,
            ambientVolume: 0.5,
            ambientPreset: 'none',
            ...JSON.parse(stored),
          };
        }
        const legacySound = localStorage.getItem('soundEnabled');
        if (legacySound !== null) {
          return {
            isMuted: legacySound === 'false',
            masterVolume: 0.7,
            sfxVolume: 0.8,
            ambientVolume: 0.5,
            ambientPreset: 'none',
          };
        }
      } catch {
        // Fallback
      }
    }

    return {
      isMuted: false,
      masterVolume: 0.7,
      sfxVolume: 0.8,
      ambientVolume: 0.5,
      ambientPreset: 'none',
    };
  }

  saveSettings() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        localStorage.setItem('soundEnabled', (!this.settings.isMuted).toString());
      } catch (e) {
        console.warn('Failed to save sound settings:', e);
      }
    }
    this.notify();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach((cb) => {
      try {
        cb(this.settings);
      } catch (err) {
        console.error('Error in sound listener callback:', err);
      }
    });
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return null;
      this.audioCtx = new AudioCtxClass();

      // Master Gain
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.settings.isMuted ? 0 : this.settings.masterVolume,
        this.audioCtx.currentTime
      );
      this.masterGain.connect(this.audioCtx.destination);

      // SFX Gain
      this.sfxGain = this.audioCtx.createGain();
      this.sfxGain.gain.setValueAtTime(this.settings.sfxVolume, this.audioCtx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Ambient Gain
      this.ambientGain = this.audioCtx.createGain();
      this.ambientGain.gain.setValueAtTime(this.settings.ambientVolume, this.audioCtx.currentTime);
      this.ambientGain.connect(this.masterGain);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  canPlay() {
    if (this.settings.isMuted) return false;
    // Check if user prefers reduced motion/sensory stimulation
    if (typeof window !== 'undefined' && window.matchMedia) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion && this.settings.sfxVolume === 0) return false;
    }
    return true;
  }

  triggerHaptic(pattern = 50) {
    if (this.settings.isMuted) return;
    try {
      const isHapticsEnabled = localStorage.getItem('hapticsEnabled') !== 'false';
      if (isHapticsEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore vibration errors
    }
  }

  /**
   * Ascending harmonic chime for correct quiz answers or goal achievements
   */
  playSuccessChime() {
    if (!this.canPlay()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6 (Major chord chime)

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.15, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.42);
    });

    this.triggerHaptic([40, 30, 60]);
  }

  /**
   * Subtle paper card flip frequency sweep
   */
  playFlipSound() {
    if (!this.canPlay()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.07);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.09);

    this.triggerHaptic(25);
  }

  /**
   * Harmonized arpeggio fanfare upon milestone/streak completion
   */
  playStreakFanfare() {
    if (!this.canPlay()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { f: 523.25, d: 0.12 }, // C5
      { f: 659.25, d: 0.12 }, // E5
      { f: 783.99, d: 0.12 }, // G5
      { f: 1046.5, d: 0.4 },  // C6
    ];

    let offset = 0;
    notes.forEach((note) => {
      const startTime = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + note.d + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + note.d + 0.2);

      offset += note.d * 0.75;
    });

    this.triggerHaptic([80, 50, 80, 50, 150]);
  }

  /**
   * Procedural ambient noise buffer generator (Brown, Pink, Rain, White)
   */
  generateNoiseBuffer(ctx, type = 'brown', seconds = 5) {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else if (type === 'rain') {
      // Pink noise base with subtle random drops
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.08;
        b1 = 0.95 * b1 + white * 0.12;
        b2 = 0.85 * b2 + white * 0.25;
        let sample = (b0 + b1 + b2) * 0.12;
        // occasional rain drop splatter impulse
        if (Math.random() < 0.002) {
          sample += (Math.random() * 0.3 - 0.15);
        }
        data[i] = sample;
      }
    } else {
      // Default: Brown noise (deep focus)
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Gain boost for deep low-end
      }
    }

    return buffer;
  }

  startAmbient(preset = 'brown') {
    if (preset === 'none') {
      this.stopAmbient();
      return;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.stopAmbient();

    const buffer = this.generateNoiseBuffer(ctx, preset, 6);
    this.ambientSource = ctx.createBufferSource();
    this.ambientSource.buffer = buffer;
    this.ambientSource.loop = true;

    // Soft lowpass filter to prevent harsh high frequencies
    const filter = ctx.createBiquadFilter();
    filter.type = preset === 'white' ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(preset === 'rain' ? 1200 : 800, ctx.currentTime);

    this.ambientSource.connect(filter);
    filter.connect(this.ambientGain);

    this.ambientSource.start();

    this.settings.ambientPreset = preset;
    this.saveSettings();
  }

  stopAmbient() {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
        this.ambientSource.disconnect();
      } catch {
        // Source may already be stopped
      }
      this.ambientSource = null;
    }
    this.settings.ambientPreset = 'none';
    this.saveSettings();
  }

  setMasterVolume(volume) {
    const val = Math.max(0, Math.min(1, volume));
    this.settings.masterVolume = val;
    if (this.masterGain && this.audioCtx && !this.settings.isMuted) {
      this.masterGain.gain.setValueAtTime(val, this.audioCtx.currentTime);
    }
    this.saveSettings();
  }

  setSfxVolume(volume) {
    const val = Math.max(0, Math.min(1, volume));
    this.settings.sfxVolume = val;
    if (this.sfxGain && this.audioCtx) {
      this.sfxGain.gain.setValueAtTime(val, this.audioCtx.currentTime);
    }
    this.saveSettings();
  }

  setAmbientVolume(volume) {
    const val = Math.max(0, Math.min(1, volume));
    this.settings.ambientVolume = val;
    if (this.ambientGain && this.audioCtx) {
      this.ambientGain.gain.setValueAtTime(val, this.audioCtx.currentTime);
    }
    this.saveSettings();
  }

  toggleMute() {
    this.settings.isMuted = !this.settings.isMuted;
    if (this.masterGain && this.audioCtx) {
      const target = this.settings.isMuted ? 0 : this.settings.masterVolume;
      this.masterGain.gain.setValueAtTime(target, this.audioCtx.currentTime);
    }
    this.saveSettings();
  }

  getSettings() {
    return { ...this.settings };
  }
}

export const soundService = new SoundService();
export default soundService;
