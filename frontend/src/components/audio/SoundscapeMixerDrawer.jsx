import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Headphones,
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  CloudRain,
  Coffee,
  Wind,
  Sparkles,
  Activity,
  Clock,
  Sliders,
  ChevronDown,
  Volume1,
} from 'lucide-react';
import soundscapeSynthesizer, {
  BINAURAL_PRESETS,
  SOUNDSCAPE_PRESETS,
} from '../../services/soundscapeSynthesizer';
import audioDuckingManager from '../../services/audioDuckingManager';

export const SoundscapeMixerDrawer = ({ className = '', defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [synthState, setSynthState] = useState(() => soundscapeSynthesizer.getState());
  const [showCustomBinaural, setShowCustomBinaural] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  useEffect(() => {
    const unsubscribeSynth = soundscapeSynthesizer.subscribe((newState) => {
      setSynthState({ ...newState });
    });
    const unsubscribeDuck = audioDuckingManager.subscribe(() => {
      setSynthState(soundscapeSynthesizer.getState());
    });
    return () => {
      unsubscribeSynth();
      unsubscribeDuck();
    };
  }, []);

  // Countdown ticker for auto-stop timer
  useEffect(() => {
    let interval = null;
    if (synthState.isPlaying && synthState.autoStopMinutes > 0) {
      setRemainingTime(soundscapeSynthesizer.getAutoStopRemainingSeconds());
      interval = setInterval(() => {
        const secs = soundscapeSynthesizer.getAutoStopRemainingSeconds();
        setRemainingTime(secs);
        if (secs <= 0) {
          clearInterval(interval);
        }
      }, 1000);
    } else {
      setRemainingTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [synthState.isPlaying, synthState.autoStopMinutes]);

  const formatCountdown = (secs) => {
    if (secs <= 0) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTogglePlay = () => {
    soundscapeSynthesizer.togglePlay();
  };

  const handleToggleMute = () => {
    soundscapeSynthesizer.toggleMute();
  };

  const handleMasterChange = (e) => {
    soundscapeSynthesizer.setMasterVolume(parseFloat(e.target.value));
  };

  const handleAmbientChange = (e) => {
    soundscapeSynthesizer.setAmbientNoiseVolume(parseFloat(e.target.value));
  };

  const handleRainChange = (e) => {
    soundscapeSynthesizer.setRainVolume(parseFloat(e.target.value));
  };

  const handleBinauralChange = (e) => {
    soundscapeSynthesizer.setBinauralVolume(parseFloat(e.target.value));
  };

  const handlePresetSelect = (presetKey) => {
    soundscapeSynthesizer.applyPreset(presetKey);
    if (!synthState.isPlaying) {
      soundscapeSynthesizer.start();
    }
  };

  const handleAutoStopChange = (minutes) => {
    soundscapeSynthesizer.setAutoStopMinutes(minutes);
  };

  return (
    <div
      className={`fixed z-40 transition-all duration-300 ${className}`}
      data-testid="soundscape-mixer-drawer"
    >
      {/* Floating Trigger Launcher Pill / Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open Soundscape & Binaural Beats Mixer"
          aria-expanded={isOpen}
          className={`fixed bottom-20 right-4 sm:bottom-6 sm:right-6 group flex items-center gap-2.5 px-3.5 py-2.5 rounded-full shadow-lg backdrop-blur-md transition-all duration-200 border ${
            synthState.isPlaying && !synthState.isMuted
              ? 'bg-primary-600 text-white border-primary-500 shadow-primary-500/25 ring-2 ring-primary-400/40 animate-pulse'
              : 'bg-white/90 dark:bg-slate-900/90 text-gray-700 dark:text-gray-200 border-gray-200/80 dark:border-slate-800 hover:shadow-xl hover:scale-105'
          }`}
        >
          <div className="relative">
            <Headphones className="w-5 h-5 transition-transform group-hover:rotate-12" />
            {synthState.isPlaying && !synthState.isMuted && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
          </div>
          <span className="text-xs font-semibold tracking-wide hidden sm:inline">
            {synthState.isPlaying
              ? synthState.isMuted
                ? 'Soundscape Muted'
                : 'Focus Audio Active'
              : 'Study Soundscape'}
          </span>
          {synthState.isPlaying && synthState.isDucking && (
            <span className="text-[10px] font-bold bg-amber-400/30 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded-md">
              Ducking
            </span>
          )}
        </button>
      )}

      {/* Floating Mixer Drawer / Card */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Soundscape Mixer Panel"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[92vw] sm:w-[410px] max-h-[88vh] overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/90 dark:border-slate-800 p-4 sm:p-5 transition-all text-gray-800 dark:text-gray-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-xl transition ${
                  synthState.isPlaying && !synthState.isMuted
                    ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-500'
                }`}
              >
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight flex items-center gap-1.5">
                  Focus Soundscape
                  {synthState.isPlaying && !synthState.isMuted && (
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  )}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Web Audio Synthesizer & Binaural Beats
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Play / Pause Primary Button */}
              <button
                type="button"
                onClick={handleTogglePlay}
                aria-label={synthState.isPlaying ? 'Pause Soundscape' : 'Play Soundscape'}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition ${
                  synthState.isPlaying
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                }`}
              >
                {synthState.isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play</span>
                  </>
                )}
              </button>

              {/* Mute Toggle */}
              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={synthState.isMuted ? 'Unmute Sound' : 'Mute Sound'}
                className={`p-1.5 rounded-lg border text-xs transition ${
                  synthState.isMuted
                    ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                {synthState.isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Soundscape Mixer"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Audio Ducking Notification Banner */}
          {synthState.isDucking && (
            <div className="mt-3 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Volume1 className="w-3.5 h-3.5 animate-pulse" />
                Audio Ducking Active
              </span>
              <span className="text-[11px] font-semibold bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
                Volume at 20% for speech
              </span>
            </div>
          )}

          {/* Quick Preset Cards */}
          <div className="mt-3">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
              Focus Presets
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(SOUNDSCAPE_PRESETS).map(([key, preset]) => {
                const isSelected = synthState.activePreset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePresetSelect(key)}
                    className={`flex items-center gap-2 p-2 rounded-xl text-left border text-xs font-medium transition ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50/80 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500/40 shadow-xs'
                        : 'border-gray-200/80 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {key === 'deepFocus' && <Wind className="w-3.5 h-3.5 text-amber-500" />}
                    {key === 'rainyLibrary' && <CloudRain className="w-3.5 h-3.5 text-blue-500" />}
                    {key === 'studyCafe' && <Coffee className="w-3.5 h-3.5 text-orange-500" />}
                    {key === 'calmMemory' && <Sparkles className="w-3.5 h-3.5 text-purple-500" />}
                    <span className="truncate">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Channel Audio Mixer Sliders */}
          <div className="mt-4 space-y-3 pt-3 border-t border-gray-100 dark:border-slate-800">
            {/* Master Volume */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-primary-500" />
                  Master Volume
                </span>
                <span className="text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                  {Math.round(synthState.masterVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={synthState.masterVolume}
                onChange={handleMasterChange}
                aria-label="Master Volume Slider"
                className="w-full accent-primary-600 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Ambient Noise Channel */}
            <div className="p-2.5 rounded-xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-amber-500" />
                  Ambient Noise
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => soundscapeSynthesizer.setAmbientNoiseType('brown')}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition ${
                      synthState.ambientNoiseType === 'brown'
                        ? 'bg-amber-500 text-white'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    Brown
                  </button>
                  <button
                    type="button"
                    onClick={() => soundscapeSynthesizer.setAmbientNoiseType('pink')}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition ${
                      synthState.ambientNoiseType === 'pink'
                        ? 'bg-pink-500 text-white'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    Pink
                  </button>
                  <span className="text-gray-500 font-mono text-[11px] ml-1">
                    {Math.round(synthState.ambientNoiseVolume * 100)}%
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={synthState.ambientNoiseVolume}
                onChange={handleAmbientChange}
                aria-label="Ambient Noise Volume"
                className="w-full accent-amber-500 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Rain & Ambience Texture Channel */}
            <div className="p-2.5 rounded-xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium flex items-center gap-1.5">
                  <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                  Atmosphere
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => soundscapeSynthesizer.setRainType('rain')}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition ${
                      synthState.rainType === 'rain'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    Rain
                  </button>
                  <button
                    type="button"
                    onClick={() => soundscapeSynthesizer.setRainType('cafe')}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition ${
                      synthState.rainType === 'cafe'
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    Café
                  </button>
                  <span className="text-gray-500 font-mono text-[11px] ml-1">
                    {Math.round(synthState.rainVolume * 100)}%
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={synthState.rainVolume}
                onChange={handleRainChange}
                aria-label="Rain and Ambience Texture Volume"
                className="w-full accent-blue-500 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Binaural Beats Channel */}
            <div className="p-2.5 rounded-xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-500" />
                  Binaural Beats
                </span>
                <span className="text-gray-500 font-mono text-[11px]">
                  {Math.round(synthState.binauralVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={synthState.binauralVolume}
                onChange={handleBinauralChange}
                aria-label="Binaural Beats Volume"
                className="w-full accent-purple-500 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg cursor-pointer mb-2"
              />

              {/* Brainwave Band Selection Tabs */}
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {Object.entries(BINAURAL_PRESETS).map(([bandKey, info]) => {
                  const isActive = synthState.binauralBand === bandKey;
                  return (
                    <button
                      key={bandKey}
                      type="button"
                      onClick={() => soundscapeSynthesizer.setBinauralBand(bandKey)}
                      title={info.desc}
                      className={`py-1 px-1 rounded-md text-center font-medium transition ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200/60 dark:border-slate-700 hover:border-purple-300'
                      }`}
                    >
                      {bandKey.charAt(0).toUpperCase() + bandKey.slice(1)} ({info.beat}Hz)
                    </button>
                  );
                })}
              </div>

              {/* Custom Frequency Expander */}
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowCustomBinaural(!showCustomBinaural)}
                  className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-0.5"
                >
                  <span>{showCustomBinaural ? 'Hide custom frequency' : 'Custom beat frequency'}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${showCustomBinaural ? 'rotate-180' : ''}`}
                  />
                </button>
                {showCustomBinaural && (
                  <div className="mt-2 text-left space-y-1.5 pt-1.5 border-t border-purple-100 dark:border-purple-900/30">
                    <div className="flex justify-between text-[11px] text-gray-500">
                      <span>Beat Frequency:</span>
                      <span className="font-mono">{synthState.binauralBeatFreq} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="45"
                      step="1"
                      value={synthState.binauralBeatFreq}
                      onChange={(e) =>
                        soundscapeSynthesizer.setBinauralFrequencies(
                          parseFloat(e.target.value),
                          synthState.binauralBaseFreq
                        )
                      }
                      aria-label="Custom Binaural Beat Frequency"
                      className="w-full accent-purple-600 h-1 bg-gray-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Study Timer Auto-Stop Controls */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>Auto-Stop:</span>
            </span>

            <div className="flex items-center gap-1">
              {[0, 15, 30, 45, 60].map((mins) => {
                const isSelected = synthState.autoStopMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleAutoStopChange(mins)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      isSelected
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {mins === 0 ? 'Off' : `${mins}m`}
                  </button>
                );
              })}
            </div>
          </div>

          {remainingTime > 0 && synthState.isPlaying && (
            <div className="mt-2 text-center text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Auto-stopping in {formatCountdown(remainingTime)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

SoundscapeMixerDrawer.propTypes = {
  className: PropTypes.string,
  defaultOpen: PropTypes.bool,
};

export default SoundscapeMixerDrawer;
