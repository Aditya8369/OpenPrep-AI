import soundService from '../services/soundService';

export const playSelectSound = () => {
  soundService.playFlipSound();
};

export const playSuccessSound = () => {
  soundService.playSuccessChime();
};

export const playTimerCompleteSound = () => {
  soundService.playStreakFanfare();
};

export const triggerHaptic = (pattern) => {
  soundService.triggerHaptic(pattern);
};

