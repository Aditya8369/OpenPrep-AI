/**
 * Native Web Audio Soundscape Synthesizer & Binaural Beats Generator
 * Synthesizes procedural ambient noise (Pink/Brown), rain/café textures,
 * and dual-oscillator binaural beats entirely in-browser using the Web Audio API.
 * Integrated with AudioDuckingManager for automatic speech/chime volume ducking.
 */

import audioDuckingManager from './audioDuckingManager';

const STORAGE_KEY = 'openprep_soundscape_mixer_settings';

export const BINAURAL_PRESETS = {
  gamma: { name: 'Gamma (40 Hz)', beat: 40, base: 200, desc: 'Peak focus & cognitive retention' },
  beta: { name: 'Beta (18 Hz)', beat: 18, base: 210, desc: 'Active problem solving & alertness' },
  alpha: { name: 'Alpha (10 Hz)', beat: 10, base: 216, desc: 'Relaxed focus & reading comprehension' },
  theta: { name: 'Theta (6 Hz)', beat: 6, base: 200, desc: 'Deep memorization & intuitive learning' },
};

export const SOUNDSCAPE_PRESETS = {
  deepFocus: {
    name: 'Deep Focus',
    ambientNoiseType: 'brown',
    ambientNoiseVolume: 0.6,
    rainType: 'rain',
    rainVolume: 0.2,
    binauralBand: 'gamma',
    binauralVolume: 0.35,
    masterVolume: 0.75,
  },
  rainyLibrary: {
    name: 'Rainy Library',
    ambientNoiseType: 'pink',
    ambientNoiseVolume: 0.35,
    rainType: 'rain',
    rainVolume: 0.65,
    binauralBand: 'alpha',
    binauralVolume: 0.25,
    masterVolume: 0.7,
  },
  studyCafe: {
    name: 'Study Café',
    ambientNoiseType: 'brown',
    ambientNoiseVolume: 0.4,
    rainType: 'cafe',
    rainVolume: 0.6,
    binauralBand: 'beta',
    binauralVolume: 0.3,
    masterVolume: 0.7,
  },
  calmMemory: {
    name: 'Calm Memory',
    ambientNoiseType: 'pink',
    ambientNoiseVolume: 0.5,
    rainType: 'rain',
    rainVolume: 0.3,
    binauralBand: 'theta',
    binauralVolume: 0.35,
    masterVolume: 0.65,
  },
};

const DEFAULT_SETTINGS = {
  isPlaying: false,
  isMuted: false,
  masterVolume: 0.7,
  ambientNoiseVolume: 0.5,
  ambientNoiseType: 'brown', // 'brown' | 'pink'
  rainVolume: 0.4,
  rainType: 'rain', // 'rain' | 'cafe'
  binauralVolume: 0.3,
  binauralBand: 'gamma', // 'gamma' | 'beta' | 'alpha' | 'theta' | 'custom'
  binauralBeatFreq: 40,
  binauralBaseFreq: 200,
  autoStopMinutes: 0, // 0 = off, 15, 30, 45, 60
  activePreset: 'deepFocus',
};

class SoundscapeSynthesizer {
  constructor() {
    this.audioCtx = null;

    // Gain Nodes
    this.masterGain = null;
    this.duckingGain = null;
    this.ambientGain = null;
    this.rainGain = null;
    this.binauralGain = null;

    // Sources & Filters
    this.ambientSource = null;
    this.ambientFilter = null;
    this.rainSource = null;
    this.rainFilter = null;

    // Rain drop pulse interval timer
    this.rainDropInterval = null;

    // Binaural Oscillators & Panners
    this.oscLeft = null;
    this.oscRight = null;
    this.pannerLeft = null;
    this.pannerRight = null;

    // Auto-stop timer
    this.autoStopTimer = null;
    this.autoStopEndTime = null;

    this.listeners = new Set();
    this.settings = this.loadSettings();
    this.unsubscribeDucking = null;
    this.subscribeDucking();
  }

  subscribeDucking() {
    if (!this.unsubscribeDucking) {
      this.unsubscribeDucking = audioDuckingManager.subscribe((duckingState) => {
        this.handleDuckingChange(duckingState);
      });
    }
  }

  loadSettings() {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            isPlaying: false, // Always start paused on fresh page load to respect autoplay policies
          };
        }
      } catch {
        // Fallback to defaults
      }
    }
    return { ...DEFAULT_SETTINGS, isPlaying: false };
  }

  saveSettings() {
    if (typeof localStorage !== 'undefined') {
      try {
        const toSave = { ...this.settings };
        delete toSave.isPlaying; // Do not save running play state
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) {
        console.warn('Failed to save soundscape settings:', e);
      }
    }
    this.notify();
  }

  subscribe(callback) {
    this.subscribeDucking();
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in soundscape listener:', err);
      }
    });
  }

  getState() {
    return {
      ...this.settings,
      isDucking: audioDuckingManager.isDucking(),
      duckingRatio: audioDuckingManager.getDuckingRatio(),
      autoStopRemainingSecs: this.getAutoStopRemainingSeconds(),
    };
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass =
        (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
      if (!AudioCtxClass) return null;

      this.audioCtx = new AudioCtxClass();
      this.initAudioGraph();
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  initAudioGraph() {
    this.subscribeDucking();
    const ctx = this.audioCtx;
    if (!ctx) return;

    // 1. Master Gain Node
    this.masterGain = ctx.createGain();
    const effectiveMaster = this.settings.isMuted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.setValueAtTime(effectiveMaster, ctx.currentTime);
    this.masterGain.connect(ctx.destination);

    // 2. Ducking Gain Node (Layered right under Master)
    this.duckingGain = ctx.createGain();
    const duckRatio = audioDuckingManager.getDuckingRatio();
    this.duckingGain.gain.setValueAtTime(duckRatio, ctx.currentTime);
    this.duckingGain.connect(this.masterGain);

    // 3. Ambient Noise Channel Gain
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.setValueAtTime(this.settings.ambientNoiseVolume, ctx.currentTime);
    this.ambientGain.connect(this.duckingGain);

    // 4. Rain / Café Channel Gain
    this.rainGain = ctx.createGain();
    this.rainGain.gain.setValueAtTime(this.settings.rainVolume, ctx.currentTime);
    this.rainGain.connect(this.duckingGain);

    // 5. Binaural Beats Channel Gain
    this.binauralGain = ctx.createGain();
    this.binauralGain.gain.setValueAtTime(this.settings.binauralVolume, ctx.currentTime);
    this.binauralGain.connect(this.duckingGain);
  }

  /**
   * Handle smooth ducking ramp (ramps down to 20% in 200ms, or restores to 100% in 300ms)
   */
  handleDuckingChange(duckingState) {
    if (this.duckingGain && this.audioCtx) {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const target = duckingState.ratio;
      const rampSeconds = (duckingState.rampTimeMs || 200) / 1000;

      this.duckingGain.gain.cancelScheduledValues(now);
      this.duckingGain.gain.setValueAtTime(this.duckingGain.gain.value, now);
      this.duckingGain.gain.linearRampToValueAtTime(target, now + rampSeconds);
    }

    this.notify();
  }

  /**
   * Generates a seamless looping noise buffer (Brown or Pink)
   */
  generateNoiseBuffer(ctx, type = 'brown', seconds = 5) {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'pink') {
      // Paul Kellet's refined 6-pole 1/f Pink Noise algorithm
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
    } else {
      // Brown Noise: Leaky integrator filter on white noise
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Warm low-end acoustic presence
      }
    }

    return buffer;
  }

  /**
   * Generates ambient texture buffer for rain or café murmur
   */
  generateTextureBuffer(ctx, type = 'rain', seconds = 6) {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'cafe') {
      // Warm low frequency café rumble + subtle ambient noise
      let b0 = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.98 * b0 + white * 0.05;
        // Periodic soft harmonic modulation simulating distant murmur
        const mod = Math.sin((i / ctx.sampleRate) * 0.8 * Math.PI * 2) * 0.04;
        data[i] = b0 * 0.8 + mod;
      }
    } else {
      // Rain texture: Pink noise foundation with pseudo-random droplet splashes
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.08;
        b1 = 0.95 * b1 + white * 0.12;
        b2 = 0.85 * b2 + white * 0.25;
        let sample = (b0 + b1 + b2) * 0.12;
        // Pseudo-random droplet impact impulses
        if (Math.random() < 0.003) {
          sample += (Math.random() * 0.4 - 0.2);
        }
        data[i] = sample;
      }
    }

    return buffer;
  }

  /**
   * Start Ambient Noise (Brown or Pink)
   */
  startAmbientNoise() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.stopAmbientNoise();

    const type = this.settings.ambientNoiseType;
    const buffer = this.generateNoiseBuffer(ctx, type, 6);

    this.ambientSource = ctx.createBufferSource();
    this.ambientSource.buffer = buffer;
    this.ambientSource.loop = true;

    // Filter to shape frequencies
    this.ambientFilter = ctx.createBiquadFilter();
    if (type === 'pink') {
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.setValueAtTime(1200, ctx.currentTime);
    } else {
      // Brown noise: deep warm lowpass
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.setValueAtTime(650, ctx.currentTime);
    }

    this.ambientSource.connect(this.ambientFilter);
    this.ambientFilter.connect(this.ambientGain);

    this.ambientSource.start();
  }

  stopAmbientNoise() {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
        this.ambientSource.disconnect();
      } catch {
        // Safe to ignore if already stopped
      }
      this.ambientSource = null;
    }
    if (this.ambientFilter) {
      try {
        this.ambientFilter.disconnect();
      } catch {
        // Ignore
      }
      this.ambientFilter = null;
    }
  }

  /**
   * Start Rain or Café Ambience
   */
  startRainTexture() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.stopRainTexture();

    const type = this.settings.rainType;
    const buffer = this.generateTextureBuffer(ctx, type, 6);

    this.rainSource = ctx.createBufferSource();
    this.rainSource.buffer = buffer;
    this.rainSource.loop = true;

    this.rainFilter = ctx.createBiquadFilter();
    if (type === 'cafe') {
      this.rainFilter.type = 'bandpass';
      this.rainFilter.frequency.setValueAtTime(450, ctx.currentTime);
      this.rainFilter.Q.setValueAtTime(1.2, ctx.currentTime);
    } else {
      // Rain: bandpass focused around 1500 Hz for gentle pattering
      this.rainFilter.type = 'bandpass';
      this.rainFilter.frequency.setValueAtTime(1400, ctx.currentTime);
      this.rainFilter.Q.setValueAtTime(0.8, ctx.currentTime);
    }

    this.rainSource.connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain);

    this.rainSource.start();

    // Spawn algorithmic raindrop pings periodically when in rain mode
    if (type === 'rain' && typeof window !== 'undefined') {
      this.rainDropInterval = setInterval(() => {
        if (!this.settings.isPlaying || this.settings.rainVolume < 0.05) return;
        this.triggerRaindropPing();
      }, 400 + Math.random() * 600);
    }
  }

  /**
   * Synthesize an algorithmic single raindrop droplet ping
   */
  triggerRaindropPing() {
    if (!this.audioCtx || !this.rainGain) return;
    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const dropGain = ctx.createGain();

      // Droplet frequency sweep (e.g. 2200 Hz down to 800 Hz over 40ms)
      const startFreq = 1800 + Math.random() * 800;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.04);

      // Rapid impulse volume envelope
      const vol = (0.02 + Math.random() * 0.04) * this.settings.rainVolume;
      dropGain.gain.setValueAtTime(vol, now);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      osc.connect(dropGain);
      dropGain.connect(this.rainGain);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Non-critical background ping
    }
  }

  stopRainTexture() {
    if (this.rainDropInterval) {
      clearInterval(this.rainDropInterval);
      this.rainDropInterval = null;
    }
    if (this.rainSource) {
      try {
        this.rainSource.stop();
        this.rainSource.disconnect();
      } catch {
        // Safe to ignore
      }
      this.rainSource = null;
    }
    if (this.rainFilter) {
      try {
        this.rainFilter.disconnect();
      } catch {
        // Ignore
      }
      this.rainFilter = null;
    }
  }

  /**
   * Start Dual-Oscillator Binaural Beats (Left Ear & Right Ear Divergence)
   */
  startBinauralBeats() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.stopBinauralBeats();

    const baseFreq = this.settings.binauralBaseFreq || 200;
    const beatFreq = this.settings.binauralBeatFreq || 40;

    // Divergence: Left = base - beat/2, Right = base + beat/2
    const freqLeft = Math.max(20, baseFreq - beatFreq / 2);
    const freqRight = Math.max(20, baseFreq + beatFreq / 2);

    this.oscLeft = ctx.createOscillator();
    this.oscRight = ctx.createOscillator();

    this.oscLeft.type = 'sine';
    this.oscRight.type = 'sine';

    this.oscLeft.frequency.setValueAtTime(freqLeft, ctx.currentTime);
    this.oscRight.frequency.setValueAtTime(freqRight, ctx.currentTime);

    // Channel routing: stereo panning or channel merger
    if (ctx.createStereoPanner) {
      this.pannerLeft = ctx.createStereoPanner();
      this.pannerRight = ctx.createStereoPanner();

      this.pannerLeft.pan.setValueAtTime(-1, ctx.currentTime); // 100% Left
      this.pannerRight.pan.setValueAtTime(1, ctx.currentTime); // 100% Right

      this.oscLeft.connect(this.pannerLeft);
      this.pannerLeft.connect(this.binauralGain);

      this.oscRight.connect(this.pannerRight);
      this.pannerRight.connect(this.binauralGain);
    } else {
      // ChannelMergerNode fallback for environments without StereoPanner
      const merger = ctx.createChannelMerger(2);
      this.oscLeft.connect(merger, 0, 0);
      this.oscRight.connect(merger, 0, 1);
      merger.connect(this.binauralGain);
    }

    this.oscLeft.start();
    this.oscRight.start();
  }

  stopBinauralBeats() {
    if (this.oscLeft) {
      try {
        this.oscLeft.stop();
        this.oscLeft.disconnect();
      } catch {
        // Ignore
      }
      this.oscLeft = null;
    }
    if (this.oscRight) {
      try {
        this.oscRight.stop();
        this.oscRight.disconnect();
      } catch {
        // Ignore
      }
      this.oscRight = null;
    }
    if (this.pannerLeft) {
      try {
        this.pannerLeft.disconnect();
      } catch {
        // Ignore
      }
      this.pannerLeft = null;
    }
    if (this.pannerRight) {
      try {
        this.pannerRight.disconnect();
      } catch {
        // Ignore
      }
      this.pannerRight = null;
    }
  }

  /**
   * Start Master Playback of All Active Layers
   */
  start() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.startAmbientNoise();
    this.startRainTexture();
    this.startBinauralBeats();

    this.settings.isPlaying = true;

    // Handle auto-stop timer if configured
    this.setupAutoStop();

    this.notify();
  }

  /**
   * Stop All Active Audio Synthesizers
   */
  stop() {
    this.stopAmbientNoise();
    this.stopRainTexture();
    this.stopBinauralBeats();
    this.clearAutoStop();

    this.settings.isPlaying = false;
    this.notify();
  }

  /**
   * Toggle between Play and Pause
   */
  togglePlay() {
    if (this.settings.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }

  /**
   * Master Mute Toggle
   */
  toggleMute() {
    this.settings.isMuted = !this.settings.isMuted;
    if (this.masterGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      const target = this.settings.isMuted ? 0 : this.settings.masterVolume;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(target, now + 0.05);
    }
    this.saveSettings();
  }

  /**
   * Adjust Master Volume (0.0 to 1.0)
   */
  setMasterVolume(val) {
    const clamped = Math.max(0, Math.min(1, val));
    this.settings.masterVolume = clamped;
    if (this.masterGain && this.audioCtx && !this.settings.isMuted) {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(clamped, now);
    }
    this.saveSettings();
  }

  /**
   * Adjust Ambient Noise Volume (Pink/Brown)
   */
  setAmbientNoiseVolume(val) {
    const clamped = Math.max(0, Math.min(1, val));
    this.settings.ambientNoiseVolume = clamped;
    if (this.ambientGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setValueAtTime(clamped, now);
    }
    this.saveSettings();
  }

  /**
   * Switch Ambient Noise Type ('brown' or 'pink')
   */
  setAmbientNoiseType(type) {
    if (type !== 'brown' && type !== 'pink') return;
    this.settings.ambientNoiseType = type;
    if (this.settings.isPlaying) {
      this.startAmbientNoise();
    }
    this.saveSettings();
  }

  /**
   * Adjust Rain / Café Volume
   */
  setRainVolume(val) {
    const clamped = Math.max(0, Math.min(1, val));
    this.settings.rainVolume = clamped;
    if (this.rainGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.rainGain.gain.cancelScheduledValues(now);
      this.rainGain.gain.setValueAtTime(clamped, now);
    }
    this.saveSettings();
  }

  /**
   * Switch Rain/Ambience Type ('rain' or 'cafe')
   */
  setRainType(type) {
    if (type !== 'rain' && type !== 'cafe') return;
    this.settings.rainType = type;
    if (this.settings.isPlaying) {
      this.startRainTexture();
    }
    this.saveSettings();
  }

  /**
   * Adjust Binaural Beats Volume
   */
  setBinauralVolume(val) {
    const clamped = Math.max(0, Math.min(1, val));
    this.settings.binauralVolume = clamped;
    if (this.binauralGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.binauralGain.gain.cancelScheduledValues(now);
      this.binauralGain.gain.setValueAtTime(clamped, now);
    }
    this.saveSettings();
  }

  /**
   * Set Binaural Brainwave Band Preset ('gamma', 'beta', 'alpha', 'theta')
   */
  setBinauralBand(bandKey) {
    if (BINAURAL_PRESETS[bandKey]) {
      const preset = BINAURAL_PRESETS[bandKey];
      this.settings.binauralBand = bandKey;
      this.settings.binauralBeatFreq = preset.beat;
      this.settings.binauralBaseFreq = preset.base;
    } else if (bandKey === 'custom') {
      this.settings.binauralBand = 'custom';
    }

    if (this.settings.isPlaying) {
      this.startBinauralBeats();
    }
    this.saveSettings();
  }

  /**
   * Set custom beat frequency (1 to 50 Hz)
   */
  setBinauralFrequencies(beatFreq, baseFreq = 200) {
    this.settings.binauralBand = 'custom';
    this.settings.binauralBeatFreq = Math.max(1, Math.min(50, beatFreq));
    this.settings.binauralBaseFreq = Math.max(100, Math.min(400, baseFreq));

    if (this.settings.isPlaying) {
      this.startBinauralBeats();
    }
    this.saveSettings();
  }

  /**
   * Apply a soundscape preset
   */
  applyPreset(presetKey) {
    const preset = SOUNDSCAPE_PRESETS[presetKey];
    if (!preset) return;

    this.settings.activePreset = presetKey;
    this.settings.ambientNoiseType = preset.ambientNoiseType;
    this.settings.ambientNoiseVolume = preset.ambientNoiseVolume;
    this.settings.rainType = preset.rainType;
    this.settings.rainVolume = preset.rainVolume;
    this.settings.masterVolume = preset.masterVolume;

    this.setBinauralBand(preset.binauralBand);
    this.settings.binauralVolume = preset.binauralVolume;

    if (this.ambientGain && this.audioCtx) {
      this.ambientGain.gain.setValueAtTime(preset.ambientNoiseVolume, this.audioCtx.currentTime);
    }
    if (this.rainGain && this.audioCtx) {
      this.rainGain.gain.setValueAtTime(preset.rainVolume, this.audioCtx.currentTime);
    }
    if (this.binauralGain && this.audioCtx) {
      this.binauralGain.gain.setValueAtTime(preset.binauralVolume, this.audioCtx.currentTime);
    }
    if (this.masterGain && this.audioCtx && !this.settings.isMuted) {
      this.masterGain.gain.setValueAtTime(preset.masterVolume, this.audioCtx.currentTime);
    }

    if (this.settings.isPlaying) {
      this.startAmbientNoise();
      this.startRainTexture();
      this.startBinauralBeats();
    }

    this.saveSettings();
  }

  /**
   * Configure Auto-Stop Timer (0 = off, 15, 30, 45, 60 minutes)
   */
  setAutoStopMinutes(minutes) {
    this.settings.autoStopMinutes = parseInt(minutes, 10) || 0;
    if (this.settings.isPlaying) {
      this.setupAutoStop();
    } else {
      this.clearAutoStop();
    }
    this.saveSettings();
  }

  setupAutoStop() {
    this.clearAutoStop();
    const minutes = this.settings.autoStopMinutes;
    if (minutes > 0) {
      this.autoStopEndTime = Date.now() + minutes * 60 * 1000;
      this.autoStopTimer = setTimeout(() => {
        this.stop();
        this.clearAutoStop();
      }, minutes * 60 * 1000);
    }
  }

  clearAutoStop() {
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }
    this.autoStopEndTime = null;
  }

  getAutoStopRemainingSeconds() {
    if (!this.autoStopEndTime) return 0;
    const remainingMs = this.autoStopEndTime - Date.now();
    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  /**
   * Completely clean up all audio nodes, unbind listeners, and close context
   */
  destroy() {
    this.stop();
    if (typeof this.unsubscribeDucking === 'function') {
      this.unsubscribeDucking();
      this.unsubscribeDucking = null;
    }
    this.listeners.clear();

    if (this.audioCtx) {
      try {
        if (this.audioCtx.state !== 'closed') {
          this.audioCtx.close().catch(() => {});
        }
      } catch {
        // Ignore
      }
      this.audioCtx = null;
    }
  }
}

export const soundscapeSynthesizer = new SoundscapeSynthesizer();
export default soundscapeSynthesizer;
