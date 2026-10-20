import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import soundService from '../services/soundService';

const SoundToggle = ({ className = '' }) => {
  const [settings, setSettings] = useState(soundService.getSettings());

  useEffect(() => {
    return soundService.subscribe((newSettings) => {
      setSettings({ ...newSettings });
    });
  }, []);

  const toggleSound = () => {
    soundService.toggleMute();
  };

  const isSoundEnabled = !settings.isMuted;

  return (
    <button
      onClick={toggleSound}
      className={`p-2 rounded-lg bg-amber-100/50 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 transition ${className}`}
      aria-label="Toggle sound and haptics"
    >
      {isSoundEnabled ? (
        <Volume2 className="h-5 w-5 text-amber-700 dark:text-amber-400" />
      ) : (
        <VolumeX className="h-5 w-5 text-stone-500" />
      )}
    </button>
  );
};

export default SoundToggle;
