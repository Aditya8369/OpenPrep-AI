import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SoundscapeMixerDrawer from './SoundscapeMixerDrawer';
import soundscapeSynthesizer from '../../services/soundscapeSynthesizer';
import audioDuckingManager from '../../services/audioDuckingManager';

// Mock Web Audio Context
class MockAudioNode {
  constructor() {
    this.gain = {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    };
    this.frequency = {
      value: 440,
      setValueAtTime: vi.fn(),
    };
    this.Q = {
      value: 1,
      setValueAtTime: vi.fn(),
    };
    this.pan = {
      value: 0,
      setValueAtTime: vi.fn(),
    };
  }

  connect(dest) {
    return dest;
  }

  disconnect() {}
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
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
      loop: false,
    };
  }

  createOscillator() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
      type: 'sine',
    };
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
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }
}

describe('SoundscapeMixerDrawer', () => {
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

  it('renders floating launcher button when drawer is closed', () => {
    render(<SoundscapeMixerDrawer defaultOpen={false} />);
    const launcher = screen.getByRole('button', { name: /Open Soundscape & Binaural Beats Mixer/i });
    expect(launcher).toBeInTheDocument();
  });

  it('opens drawer dialog upon clicking the floating button', () => {
    render(<SoundscapeMixerDrawer defaultOpen={false} />);
    const launcher = screen.getByRole('button', { name: /Open Soundscape & Binaural Beats Mixer/i });

    fireEvent.click(launcher);

    const dialog = screen.getByRole('dialog', { name: /Soundscape Mixer Panel/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Focus Soundscape/i)).toBeInTheDocument();
  });

  it('toggles playback via Play/Pause button in the drawer', () => {
    render(<SoundscapeMixerDrawer defaultOpen={true} />);

    const playBtn = screen.getByRole('button', { name: /Play Soundscape/i });
    fireEvent.click(playBtn);

    expect(soundscapeSynthesizer.getState().isPlaying).toBe(true);
    expect(screen.getByRole('button', { name: /Pause Soundscape/i })).toBeInTheDocument();
  });

  it('toggles master mute button', () => {
    render(<SoundscapeMixerDrawer defaultOpen={true} />);

    const muteBtn = screen.getByRole('button', { name: /Mute Sound/i });
    fireEvent.click(muteBtn);

    expect(soundscapeSynthesizer.getState().isMuted).toBe(true);
  });

  it('adjusts master volume slider', () => {
    render(<SoundscapeMixerDrawer defaultOpen={true} />);

    const masterSlider = screen.getByLabelText(/Master Volume Slider/i);
    fireEvent.change(masterSlider, { target: { value: '0.9' } });

    expect(soundscapeSynthesizer.getState().masterVolume).toBe(0.9);
  });

  it('selects focus preset and updates multi-channel settings', () => {
    render(<SoundscapeMixerDrawer defaultOpen={true} />);

    const rainyBtn = screen.getByRole('button', { name: /Rainy Library/i });
    fireEvent.click(rainyBtn);

    expect(soundscapeSynthesizer.getState().activePreset).toBe('rainyLibrary');
    expect(soundscapeSynthesizer.getState().rainType).toBe('rain');
  });

  it('switches ambient noise between Brown and Pink', () => {
    render(<SoundscapeMixerDrawer defaultOpen={true} />);

    const pinkBtn = screen.getByRole('button', { name: /^Pink$/i });
    fireEvent.click(pinkBtn);

    expect(soundscapeSynthesizer.getState().ambientNoiseType).toBe('pink');
  });

  it('switches atmosphere between Rain and Café', () => {
    render(<SoundscapeMixerDrawer defaultOpen={true} />);

    const cafeBtn = screen.getByRole('button', { name: /^Café$/i });
    fireEvent.click(cafeBtn);

    expect(soundscapeSynthesizer.getState().rainType).toBe('cafe');
  });

  it('switches binaural brainwave tabs (Gamma, Beta, Alpha, Theta)', () => {
    render(<SoundscapeMixerDrawer defaultOpen={true} />);

    const alphaBtn = screen.getByRole('button', { name: /Alpha \(10Hz\)/i });
    fireEvent.click(alphaBtn);

    expect(soundscapeSynthesizer.getState().binauralBand).toBe('alpha');
    expect(soundscapeSynthesizer.getState().binauralBeatFreq).toBe(10);
  });

  it('adjusts auto-stop timer options', () => {
    render(<SoundscapeMixerDrawer defaultOpen={true} />);

    const timerBtn = screen.getByRole('button', { name: /^30m$/i });
    fireEvent.click(timerBtn);

    expect(soundscapeSynthesizer.getState().autoStopMinutes).toBe(30);
  });

  it('displays audio ducking alert banner when ducking is triggered', () => {
    render(<SoundscapeMixerDrawer defaultOpen={true} />);

    expect(screen.queryByText(/Audio Ducking Active/i)).not.toBeInTheDocument();

    act(() => {
      audioDuckingManager.startDucking('tts-test', 0.2, 200);
    });

    expect(screen.getByText(/Audio Ducking Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Volume at 20% for speech/i)).toBeInTheDocument();

    act(() => {
      audioDuckingManager.stopDucking('tts-test', 200);
    });

    expect(screen.queryByText(/Audio Ducking Active/i)).not.toBeInTheDocument();
  });

  it('closes drawer dialog when close button is clicked', () => {
    render(<SoundscapeMixerDrawer defaultOpen={true} />);

    const closeBtn = screen.getByRole('button', { name: /Close Soundscape Mixer/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog', { name: /Soundscape Mixer Panel/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Soundscape & Binaural Beats Mixer/i })).toBeInTheDocument();
  });
});
