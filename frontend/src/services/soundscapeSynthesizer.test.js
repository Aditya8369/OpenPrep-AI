import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import soundscapeSynthesizer, {
  BINAURAL_PRESETS,
  SOUNDSCAPE_PRESETS,
} from './soundscapeSynthesizer';
import audioDuckingManager from './audioDuckingManager';

// Mock Web Audio Context
class MockAudioNode {
  constructor() {
    this.connectedTo = [];
    this.gain = {
      value: 1,
      setValueAtTime: vi.fn((val) => {
        this.gain.value = val;
      }),
      linearRampToValueAtTime: vi.fn((val) => {
        this.gain.value = val;
      }),
      exponentialRampToValueAtTime: vi.fn((val) => {
        this.gain.value = val;
      }),
      cancelScheduledValues: vi.fn(),
    };
    this.frequency = {
      value: 440,
      setValueAtTime: vi.fn((val) => {
        this.frequency.value = val;
      }),
      exponentialRampToValueAtTime: vi.fn(),
    };
    this.Q = {
      value: 1,
      setValueAtTime: vi.fn((val) => {
        this.Q.value = val;
      }),
    };
    this.pan = {
      value: 0,
      setValueAtTime: vi.fn((val) => {
        this.pan.value = val;
      }),
    };
  }

  connect(dest) {
    this.connectedTo.push(dest);
    return dest;
  }

  disconnect() {
    this.connectedTo = [];
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor() {
    super();
    this.buffer = null;
    this.loop = false;
    this.start = vi.fn();
    this.stop = vi.fn();
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super();
    this.type = 'sine';
    this.start = vi.fn();
    this.stop = vi.fn();
  }
}

class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = new MockAudioNode();
  }

  createGain() {
    return new MockAudioNode();
  }

  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }

  createOscillator() {
    return new MockOscillatorNode();
  }

  createBiquadFilter() {
    return new MockAudioNode();
  }

  createStereoPanner() {
    return new MockAudioNode();
  }

  createChannelMerger() {
    return new MockAudioNode();
  }

  createBuffer(channels, length, sampleRate) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

describe('soundscapeSynthesizer', () => {
  beforeEach(() => {
    localStorage.clear();
    window.AudioContext = MockAudioContext;
    window.webkitAudioContext = MockAudioContext;
    audioDuckingManager.reset();
    soundscapeSynthesizer.stop();
  });

  afterEach(() => {
    soundscapeSynthesizer.destroy();
  });

  it('initializes with default settings', () => {
    const state = soundscapeSynthesizer.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.isMuted).toBe(false);
    expect(state.masterVolume).toBeGreaterThan(0);
    expect(state.ambientNoiseVolume).toBe(0.5);
    expect(state.rainVolume).toBe(0.4);
    expect(state.binauralVolume).toBe(0.3);
    expect(state.binauralBand).toBe('gamma');
  });

  it('starts audio synthesis and sets isPlaying to true', () => {
    soundscapeSynthesizer.start();
    const state = soundscapeSynthesizer.getState();

    expect(state.isPlaying).toBe(true);
    expect(soundscapeSynthesizer.ambientSource).not.toBeNull();
    expect(soundscapeSynthesizer.rainSource).not.toBeNull();
    expect(soundscapeSynthesizer.oscLeft).not.toBeNull();
    expect(soundscapeSynthesizer.oscRight).not.toBeNull();
  });

  it('stops audio synthesis cleanly without errors', () => {
    soundscapeSynthesizer.start();
    soundscapeSynthesizer.stop();
    const state = soundscapeSynthesizer.getState();

    expect(state.isPlaying).toBe(false);
    expect(soundscapeSynthesizer.ambientSource).toBeNull();
    expect(soundscapeSynthesizer.rainSource).toBeNull();
    expect(soundscapeSynthesizer.oscLeft).toBeNull();
    expect(soundscapeSynthesizer.oscRight).toBeNull();
  });

  it('toggles playback with togglePlay', () => {
    expect(soundscapeSynthesizer.getState().isPlaying).toBe(false);
    soundscapeSynthesizer.togglePlay();
    expect(soundscapeSynthesizer.getState().isPlaying).toBe(true);
    soundscapeSynthesizer.togglePlay();
    expect(soundscapeSynthesizer.getState().isPlaying).toBe(false);
  });

  it('generates multi-channel buffers for Brown and Pink noise', () => {
    const ctx = new MockAudioContext();
    const brownBuffer = soundscapeSynthesizer.generateNoiseBuffer(ctx, 'brown', 1);
    expect(brownBuffer.length).toBe(ctx.sampleRate * 1);

    const pinkBuffer = soundscapeSynthesizer.generateNoiseBuffer(ctx, 'pink', 1);
    expect(pinkBuffer.length).toBe(ctx.sampleRate * 1);
  });

  it('generates rain and café texture buffers', () => {
    const ctx = new MockAudioContext();
    const rainBuffer = soundscapeSynthesizer.generateTextureBuffer(ctx, 'rain', 1);
    expect(rainBuffer.length).toBe(ctx.sampleRate * 1);

    const cafeBuffer = soundscapeSynthesizer.generateTextureBuffer(ctx, 'cafe', 1);
    expect(cafeBuffer.length).toBe(ctx.sampleRate * 1);
  });

  it('updates master, ambient, rain, and binaural volumes correctly', () => {
    soundscapeSynthesizer.setMasterVolume(0.85);
    expect(soundscapeSynthesizer.getState().masterVolume).toBe(0.85);

    soundscapeSynthesizer.setAmbientNoiseVolume(0.65);
    expect(soundscapeSynthesizer.getState().ambientNoiseVolume).toBe(0.65);

    soundscapeSynthesizer.setRainVolume(0.55);
    expect(soundscapeSynthesizer.getState().rainVolume).toBe(0.55);

    soundscapeSynthesizer.setBinauralVolume(0.45);
    expect(soundscapeSynthesizer.getState().binauralVolume).toBe(0.45);
  });

  it('toggles master mute', () => {
    soundscapeSynthesizer.toggleMute();
    expect(soundscapeSynthesizer.getState().isMuted).toBe(true);
    soundscapeSynthesizer.toggleMute();
    expect(soundscapeSynthesizer.getState().isMuted).toBe(false);
  });

  it('switches binaural brainwave band presets (Gamma, Beta, Alpha, Theta)', () => {
    soundscapeSynthesizer.setBinauralBand('alpha');
    let state = soundscapeSynthesizer.getState();
    expect(state.binauralBand).toBe('alpha');
    expect(state.binauralBeatFreq).toBe(BINAURAL_PRESETS.alpha.beat);

    soundscapeSynthesizer.setBinauralBand('theta');
    state = soundscapeSynthesizer.getState();
    expect(state.binauralBand).toBe('theta');
    expect(state.binauralBeatFreq).toBe(BINAURAL_PRESETS.theta.beat);

    soundscapeSynthesizer.setBinauralFrequencies(25, 220);
    state = soundscapeSynthesizer.getState();
    expect(state.binauralBand).toBe('custom');
    expect(state.binauralBeatFreq).toBe(25);
    expect(state.binauralBaseFreq).toBe(220);
  });

  it('applies curated soundscape presets (deepFocus, rainyLibrary, studyCafe, calmMemory)', () => {
    soundscapeSynthesizer.applyPreset('studyCafe');
    const state = soundscapeSynthesizer.getState();

    expect(state.activePreset).toBe('studyCafe');
    expect(state.rainType).toBe(SOUNDSCAPE_PRESETS.studyCafe.rainType);
    expect(state.binauralBand).toBe(SOUNDSCAPE_PRESETS.studyCafe.binauralBand);
  });

  it('configures auto-stop timer and handles remaining time', () => {
    soundscapeSynthesizer.start();
    soundscapeSynthesizer.setAutoStopMinutes(15);

    expect(soundscapeSynthesizer.getState().autoStopMinutes).toBe(15);
    const remaining = soundscapeSynthesizer.getAutoStopRemainingSeconds();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(15 * 60);

    soundscapeSynthesizer.setAutoStopMinutes(0);
    expect(soundscapeSynthesizer.getAutoStopRemainingSeconds()).toBe(0);
  });

  it('reacts to audio ducking manager changes smoothly', () => {
    soundscapeSynthesizer.start();

    // Trigger ducking
    audioDuckingManager.startDucking('tts', 0.2, 200);
    expect(soundscapeSynthesizer.duckingGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.2,
      expect.any(Number)
    );

    // Stop ducking
    audioDuckingManager.stopDucking('tts', 300);
    expect(soundscapeSynthesizer.duckingGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1.0,
      expect.any(Number)
    );
  });
});
