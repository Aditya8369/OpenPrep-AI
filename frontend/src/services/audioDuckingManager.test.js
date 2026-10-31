import { describe, it, expect, beforeEach, vi } from 'vitest';
import audioDuckingManager from './audioDuckingManager';

describe('audioDuckingManager', () => {
  beforeEach(() => {
    audioDuckingManager.reset();
  });

  it('starts in unducked state by default', () => {
    expect(audioDuckingManager.isDucking()).toBe(false);
    expect(audioDuckingManager.getDuckingRatio()).toBe(1.0);
  });

  it('correctly transitions to ducked ratio on startDucking', () => {
    const listener = vi.fn();
    const unsub = audioDuckingManager.subscribe(listener);

    audioDuckingManager.startDucking('tts', 0.2, 200);

    expect(audioDuckingManager.isDucking()).toBe(true);
    expect(audioDuckingManager.getDuckingRatio()).toBe(0.2);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        isDucking: true,
        ratio: 0.2,
        rampTimeMs: 200,
        sourceId: 'tts',
      })
    );

    unsub();
  });

  it('handles multiple overlapping ducking sources and restores when all finish', () => {
    audioDuckingManager.startDucking('tts');
    audioDuckingManager.startDucking('chime');

    expect(audioDuckingManager.isDucking()).toBe(true);
    expect(audioDuckingManager.getDuckingRatio()).toBe(0.2);

    // Stop one source — still ducking because of chime
    audioDuckingManager.stopDucking('tts');
    expect(audioDuckingManager.isDucking()).toBe(true);
    expect(audioDuckingManager.getDuckingRatio()).toBe(0.2);

    // Stop second source — now unducks completely
    audioDuckingManager.stopDucking('chime');
    expect(audioDuckingManager.isDucking()).toBe(false);
    expect(audioDuckingManager.getDuckingRatio()).toBe(1.0);
  });

  it('dispatches custom window events on duck and unduck', () => {
    const duckHandler = vi.fn();
    const unduckHandler = vi.fn();

    window.addEventListener('openprep:audio-duck', duckHandler);
    window.addEventListener('openprep:audio-unduck', unduckHandler);

    audioDuckingManager.startDucking('test-source');
    expect(duckHandler).toHaveBeenCalled();
    expect(duckHandler.mock.calls[0][0].detail).toEqual(
      expect.objectContaining({
        sourceId: 'test-source',
        targetRatio: 0.2,
      })
    );

    audioDuckingManager.stopDucking('test-source');
    expect(unduckHandler).toHaveBeenCalled();

    window.removeEventListener('openprep:audio-duck', duckHandler);
    window.removeEventListener('openprep:audio-unduck', unduckHandler);
  });

  it('wraps a SpeechSynthesisUtterance and triggers ducking onstart, unducking onend', () => {
    const utterance = {
      text: 'Hello OpenPrep',
      onstart: vi.fn(),
      onend: vi.fn(),
      onerror: vi.fn(),
    };

    audioDuckingManager.wrapUtterance(utterance, 'speech-test');

    expect(audioDuckingManager.isDucking()).toBe(false);

    // Simulate start
    utterance.onstart({ type: 'start' });
    expect(audioDuckingManager.isDucking()).toBe(true);

    // Simulate end
    utterance.onend({ type: 'end' });
    expect(audioDuckingManager.isDucking()).toBe(false);
  });

  it('unducks when utterance triggers onerror', () => {
    const utterance = {
      text: 'Error test',
    };

    audioDuckingManager.wrapUtterance(utterance, 'error-source');
    utterance.onstart();
    expect(audioDuckingManager.isDucking()).toBe(true);

    utterance.onerror();
    expect(audioDuckingManager.isDucking()).toBe(false);
  });

  it('duckDuring executes an async task while maintaining ducking status', async () => {
    let wasDuckedDuring = false;

    await audioDuckingManager.duckDuring(async () => {
      wasDuckedDuring = audioDuckingManager.isDucking();
    }, 'async-worker');

    expect(wasDuckedDuring).toBe(true);
    expect(audioDuckingManager.isDucking()).toBe(false);
  });
});
