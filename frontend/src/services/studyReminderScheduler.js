/**
 * @fileoverview Study Reminder Scheduler for OpenPrep.
 * Manages daily study reminder timers, timezone calculations, and localStorage persistence.
 */

import { sendStudyNotification } from './notificationService';

export const REMINDER_STORAGE_KEY = 'openprep_study_reminder_settings';

export const DEFAULT_REMINDER_SETTINGS = {
  enabled: false,
  reminderTime: '19:00', // 24-hr format (HH:mm)
  targetDestination: '/flashcards',
  timezone: typeof Intl !== 'undefined' && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC',
  customMessage: "It's time for your daily study session! Keep your streak alive.",
  lastTriggeredDate: null,
};

let activeTimerId = null;

/**
 * Retrieves the stored reminder settings, merged with sensible defaults.
 * @returns {typeof DEFAULT_REMINDER_SETTINGS}
 */
export const getReminderSettings = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(REMINDER_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_REMINDER_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_REMINDER_SETTINGS,
      ...parsed,
      timezone: parsed.timezone || DEFAULT_REMINDER_SETTINGS.timezone,
    };
  } catch (e) {
    console.error('[StudyReminderScheduler] Failed to parse stored settings:', e);
    return { ...DEFAULT_REMINDER_SETTINGS };
  }
};

/**
 * Persists updated reminder settings to localStorage.
 * @param {Partial<typeof DEFAULT_REMINDER_SETTINGS>} updates
 * @returns {typeof DEFAULT_REMINDER_SETTINGS}
 */
export const saveReminderSettings = (updates) => {
  const current = getReminderSettings();
  const next = { ...current, ...updates };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('[StudyReminderScheduler] Failed to save settings to localStorage:', e);
    }
  }

  // If enabled status or reminder time changed, restart scheduler
  if (next.enabled) {
    scheduleDailyReminder();
  } else {
    cancelDailyReminder();
  }

  return next;
};

/**
 * Calculates the next target Date for a given "HH:mm" time string.
 * If the time has already passed today, targets the same time tomorrow.
 * 
 * @param {string} timeString "HH:mm"
 * @param {Date} [referenceDate=new Date()]
 * @returns {Date}
 */
export const getNextReminderDate = (timeString = '19:00', referenceDate = new Date()) => {
  const [hoursStr, minutesStr] = timeString.split(':');
  const hours = parseInt(hoursStr, 10) || 0;
  const minutes = parseInt(minutesStr, 10) || 0;

  const target = new Date(referenceDate);
  target.setHours(hours, minutes, 0, 0);

  // If time already passed today, schedule for tomorrow
  if (target.getTime() <= referenceDate.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target;
};

/**
 * Calculates milliseconds remaining until the next scheduled reminder time.
 * @param {string} timeString "HH:mm"
 * @param {Date} [referenceDate=new Date()]
 * @returns {number} Delay in milliseconds (at least 0)
 */
export const calculateMillisecondsUntilNextReminder = (timeString = '19:00', referenceDate = new Date()) => {
  const nextDate = getNextReminderDate(timeString, referenceDate);
  return Math.max(0, nextDate.getTime() - referenceDate.getTime());
};

/**
 * Cancels any active reminder timeout.
 */
export const cancelDailyReminder = () => {
  if (activeTimerId !== null) {
    clearTimeout(activeTimerId);
    activeTimerId = null;
  }
};

/**
 * Schedules a daily reminder based on the saved settings.
 * When the timer elapses, triggers notification and reschedules for the following day.
 * 
 * @param {Function} [customTrigger] Optional callback for custom notification or testing
 * @returns {number|null} Active timer ID or null if disabled
 */
export const scheduleDailyReminder = (customTrigger = null) => {
  cancelDailyReminder();

  const settings = getReminderSettings();
  if (!settings.enabled) {
    return null;
  }

  const delayMs = calculateMillisecondsUntilNextReminder(settings.reminderTime);

  activeTimerId = setTimeout(() => {
    // 1. Dispatch notification
    if (typeof customTrigger === 'function') {
      customTrigger(settings);
    } else {
      sendStudyNotification('OpenPrep Study Reminder 📚', {
        body: settings.customMessage || "It's time for your daily study session! Keep your streak alive.",
        url: settings.targetDestination || '/flashcards',
        tag: 'openprep-daily-study-reminder',
      });
    }

    // 2. Record trigger date
    const todayStr = new Date().toISOString().split('T')[0];
    saveReminderSettings({ lastTriggeredDate: todayStr });

    // 3. Reschedule automatically for the following day
    scheduleDailyReminder(customTrigger);
  }, delayMs);

  return activeTimerId;
};

/**
 * Returns current scheduler status for UI introspection.
 * @returns {{ isScheduled: boolean, nextReminderAt: Date | null, settings: typeof DEFAULT_REMINDER_SETTINGS }}
 */
export const getSchedulerStatus = () => {
  const settings = getReminderSettings();
  const isScheduled = settings.enabled && activeTimerId !== null;
  const nextReminderAt = settings.enabled ? getNextReminderDate(settings.reminderTime) : null;

  return {
    isScheduled,
    nextReminderAt,
    settings,
  };
};
