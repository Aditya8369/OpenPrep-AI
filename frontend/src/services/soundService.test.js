import test from 'node:test';
import assert from 'node:assert/strict';

// Mock browser globals for node test environment
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

global.window = {
  AudioContext: class MockAudioContext {
    constructor() {
      this.currentTime = 0;
      this.state = 'running';
      this.destination = {};
      this.sampleRate = 44100;
    }
    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime(v) { this.value = v; },
          linearRampToValueAtTime(v) { this.value = v; },
          exponentialRampToValueAtTime(v) { this.value = v; }
        },
        connect() {},
        disconnect() {}
      };
    }
    createOscillator() {
      return {
        frequency: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {}
        },
        type: 'sine',
        connect() {},
        start() {},
        stop() {}
      };
    }
    createBiquadFilter() {
      return {
        frequency: { setValueAtTime() {} },
        type: 'lowpass',
        connect() {}
      };
    }
    createBuffer(channels, length, sampleRate) {
      return {
        getChannelData: () => new Float32Array(length),
        length,
        sampleRate
      };
    }
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        connect() {},
        start() {},
        stop() {},
        disconnect() {}
      };
    }
  }
};

if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = {};
}
try {
  globalThis.navigator.vibrate = (pattern) => {
    globalThis.navigator._lastVibrate = pattern;
    return true;
  };
} catch {
  Object.defineProperty(globalThis.navigator, 'vibrate', {
    value: (pattern) => {
      globalThis.navigator._lastVibrate = pattern;
      return true;
    },
    configurable: true,
  });
}

import { soundService } from './soundService.js';

test('soundService initializes with default or stored settings', () => {
  const settings = soundService.getSettings();
  assert.equal(typeof settings.isMuted, 'boolean');
  assert.equal(typeof settings.masterVolume, 'number');
  assert.equal(typeof settings.sfxVolume, 'number');
  assert.equal(typeof settings.ambientVolume, 'number');
});

test('soundService toggles mute and updates localStorage', () => {
  const initialMute = soundService.getSettings().isMuted;
  soundService.toggleMute();
  assert.equal(soundService.getSettings().isMuted, !initialMute);
  assert.equal(localStorage.getItem('soundEnabled'), initialMute ? 'true' : 'false');

  // Toggle back
  soundService.toggleMute();
  assert.equal(soundService.getSettings().isMuted, initialMute);
});

test('soundService sets volume ranges correctly (0 to 1 clamp)', () => {
  soundService.setMasterVolume(0.85);
  assert.equal(soundService.getSettings().masterVolume, 0.85);

  soundService.setMasterVolume(1.5);
  assert.equal(soundService.getSettings().masterVolume, 1.0);

  soundService.setMasterVolume(-0.2);
  assert.equal(soundService.getSettings().masterVolume, 0);

  soundService.setMasterVolume(0.7);
});

test('soundService triggers haptic and audio micro-cues without throwing', () => {
  assert.doesNotThrow(() => soundService.playSuccessChime());
  assert.doesNotThrow(() => soundService.playFlipSound());
  assert.doesNotThrow(() => soundService.playStreakFanfare());
});

test('soundService generates ambient noise and stops cleanly', () => {
  assert.doesNotThrow(() => soundService.startAmbient('brown'));
  assert.equal(soundService.getSettings().ambientPreset, 'brown');

  assert.doesNotThrow(() => soundService.startAmbient('rain'));
  assert.equal(soundService.getSettings().ambientPreset, 'rain');

  assert.doesNotThrow(() => soundService.stopAmbient());
  assert.equal(soundService.getSettings().ambientPreset, 'none');
});
