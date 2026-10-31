/**
 * Audio Ducking Manager
 * Coordinates volume ducking for background audio/ambient soundscapes
 * when speech synthesis (TTS), voice prompts, or sound alerts play.
 *
 * Smoothly ramps ambient sound volume down to 20% over 200ms when active,
 * then smoothly ramps back up once speech or alert concludes.
 */

class AudioDuckingManager {
  constructor() {
    this.activeSources = new Set();
    this.listeners = new Set();
    this.targetDuckedRatio = 0.2;
    this.rampTimeMs = 200;
    this.restoreRampTimeMs = 300;
  }

  /**
   * Check if any audio source is currently requesting ducking
   */
  isDucking() {
    return this.activeSources.size > 0;
  }

  /**
   * Get current volume multiplier ratio (1.0 = normal, 0.2 = ducked)
   */
  getDuckingRatio() {
    return this.isDucking() ? this.targetDuckedRatio : 1.0;
  }

  /**
   * Start ducking from a named audio source (e.g. 'tts', 'quiz-prompt', 'chime')
   */
  startDucking(sourceId = 'default', targetLevel = 0.2, rampTimeMs = 200) {
    this.targetDuckedRatio = targetLevel;
    this.rampTimeMs = rampTimeMs;
    const wasDucking = this.isDucking();
    this.activeSources.add(sourceId);

    this.notify({
      isDucking: true,
      ratio: this.targetDuckedRatio,
      rampTimeMs: this.rampTimeMs,
      sourceId,
      activeSources: Array.from(this.activeSources),
    });

    if (!wasDucking && typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('openprep:audio-duck', {
            detail: {
              sourceId,
              targetRatio: this.targetDuckedRatio,
              rampTimeMs: this.rampTimeMs,
            },
          })
        );
      } catch {
        // Safe fallback in non-browser envs
      }
    }
  }

  /**
   * Stop ducking for a named audio source
   */
  stopDucking(sourceId = 'default', rampTimeMs = 300) {
    this.restoreRampTimeMs = rampTimeMs;
    this.activeSources.delete(sourceId);
    const stillDucking = this.isDucking();

    this.notify({
      isDucking: stillDucking,
      ratio: stillDucking ? this.targetDuckedRatio : 1.0,
      rampTimeMs: this.restoreRampTimeMs,
      sourceId,
      activeSources: Array.from(this.activeSources),
    });

    if (!stillDucking && typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('openprep:audio-unduck', {
            detail: {
              sourceId,
              targetRatio: 1.0,
              rampTimeMs: this.restoreRampTimeMs,
            },
          })
        );
      } catch {
        // Safe fallback
      }
    }
  }

  /**
   * Clear all active ducking sources immediately
   */
  reset() {
    this.activeSources.clear();
    this.notify({
      isDucking: false,
      ratio: 1.0,
      rampTimeMs: 100,
      sourceId: 'reset',
      activeSources: [],
    });
  }

  /**
   * Wrap a SpeechSynthesisUtterance with automatic ducking on start and unducking on end/error
   */
  wrapUtterance(utterance, sourceId = 'tts') {
    if (!utterance) return utterance;

    const originalOnStart = utterance.onstart;
    const originalOnEnd = utterance.onend;
    const originalOnError = utterance.onerror;

    utterance.onstart = (event) => {
      this.startDucking(sourceId);
      if (typeof originalOnStart === 'function') {
        originalOnStart.call(utterance, event);
      }
    };

    const cleanup = (event, originalHandler) => {
      this.stopDucking(sourceId);
      if (typeof originalHandler === 'function') {
        originalHandler.call(utterance, event);
      }
    };

    utterance.onend = (event) => cleanup(event, originalOnEnd);
    utterance.onerror = (event) => cleanup(event, originalOnError);

    return utterance;
  }

  /**
   * Automatically duck during an async operation or Promise
   */
  async duckDuring(action, sourceId = 'async-task') {
    this.startDucking(sourceId);
    try {
      if (typeof action === 'function') {
        return await action();
      }
      return await action;
    } finally {
      this.stopDucking(sourceId);
    }
  }

  /**
   * Subscribe to ducking events
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(data) {
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error('Error in ducking listener callback:', err);
      }
    });
  }
}

export const audioDuckingManager = new AudioDuckingManager();
export default audioDuckingManager;
