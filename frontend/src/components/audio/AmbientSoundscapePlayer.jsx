import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Volume2, VolumeX, Sparkles, CloudRain, Wind, Disc, Music, Sliders } from 'lucide-react';
import soundService from '../../services/soundService';

const PRESETS = [
  { id: 'none', label: 'Off', icon: Disc, desc: 'Silence' },
  { id: 'brown', label: 'Brown Noise', icon: Wind, desc: 'Deep focus low-frequency rumble' },
  { id: 'pink', label: 'Pink Noise', icon: Sparkles, desc: 'Balanced gentle frequencies for reading' },
  { id: 'rain', label: 'Calm Rain', icon: CloudRain, desc: 'Simulated ambient rainfall' },
  { id: 'white', label: 'White Noise', icon: Music, desc: 'Distraction-blocking steady static' },
];

export const AmbientSoundscapePlayer = ({ className = '', isCompact = false }) => {
  const [settings, setSettings] = useState(soundService.getSettings());
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const unsubscribe = soundService.subscribe((newSettings) => {
      setSettings({ ...newSettings });
    });
    return () => unsubscribe();
  }, []);

  const handlePresetSelect = (presetId) => {
    if (settings.ambientPreset === presetId) {
      soundService.stopAmbient();
    } else {
      soundService.startAmbient(presetId);
    }
  };

  const handleToggleMute = () => {
    soundService.toggleMute();
  };

  return (
    <div
      className={`bg-white dark:bg-slate-800/90 rounded-2xl shadow-sm border border-neutral-200 dark:border-slate-700/80 p-4 transition-all duration-200 ${className}`}
      data-testid="ambient-soundscape-player"
    >
      {/* Header with Mute and Master Controls */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={settings.isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className={`p-2 rounded-xl transition flex items-center justify-center ${
              settings.isMuted
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                : 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400'
            }`}
          >
            {settings.isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-none">
              Audio & Focus Ambience
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {settings.isMuted ? 'Muted' : settings.ambientPreset !== 'none' ? `Playing ${settings.ambientPreset}` : 'Ambient Off'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-label="Toggle Advanced Audio Controls"
          className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-700 text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 transition"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{showAdvanced ? 'Simple' : 'Mixer'}</span>
        </button>
      </div>

      {/* Preset Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        {PRESETS.map((p) => {
          const Icon = p.icon;
          const isActive = settings.ambientPreset === p.id && !settings.isMuted;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetSelect(p.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-medium transition ${
                isActive
                  ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 shadow-sm ring-1 ring-primary-500'
                  : 'border-neutral-200 dark:border-slate-700/70 hover:border-neutral-300 dark:hover:border-slate-600 bg-neutral-50/50 dark:bg-slate-800 text-neutral-700 dark:text-neutral-300'
              }`}
              title={p.desc}
            >
              <Icon className={`w-4 h-4 mb-1 ${isActive ? 'text-primary-600 dark:text-primary-400 animate-pulse' : 'text-neutral-500 dark:text-neutral-400'}`} />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sliders Area */}
      <div className="space-y-2.5 pt-2 border-t border-neutral-100 dark:border-slate-700/60">
        {/* Master Volume */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-16">
            Master: {Math.round(settings.masterVolume * 100)}%
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.masterVolume}
            onChange={(e) => soundService.setMasterVolume(parseFloat(e.target.value))}
            aria-label="Master Volume"
            className="w-full accent-primary-600 h-1.5 bg-neutral-200 dark:bg-slate-700 rounded-lg cursor-pointer"
          />
        </div>

        {/* Detailed Mixer (Advanced) */}
        {showAdvanced && (
          <div className="space-y-2 pt-2 border-t border-dashed border-neutral-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 w-16">
                Ambience: {Math.round(settings.ambientVolume * 100)}%
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.ambientVolume}
                onChange={(e) => soundService.setAmbientVolume(parseFloat(e.target.value))}
                aria-label="Ambience Volume"
                className="w-full accent-emerald-600 h-1.5 bg-neutral-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 w-16">
                Effects: {Math.round(settings.sfxVolume * 100)}%
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.sfxVolume}
                onChange={(e) => soundService.setSfxVolume(parseFloat(e.target.value))}
                aria-label="SFX Volume"
                className="w-full accent-purple-600 h-1.5 bg-neutral-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Test Micro-cues Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <span className="text-[11px] text-neutral-400 font-medium">Test:</span>
              <button
                type="button"
                onClick={() => soundService.playSuccessChime()}
                className="text-[11px] px-2 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded hover:bg-emerald-100"
              >
                Chime
              </button>
              <button
                type="button"
                onClick={() => soundService.playFlipSound()}
                className="text-[11px] px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded hover:bg-blue-100"
              >
                Card Flip
              </button>
              <button
                type="button"
                onClick={() => soundService.playStreakFanfare()}
                className="text-[11px] px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 rounded hover:bg-amber-100"
              >
                Fanfare
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

AmbientSoundscapePlayer.propTypes = {
  className: PropTypes.string,
  isCompact: PropTypes.bool,
};

export default AmbientSoundscapePlayer;
