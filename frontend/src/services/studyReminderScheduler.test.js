import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  REMINDER_STORAGE_KEY,
  DEFAULT_REMINDER_SETTINGS,
  getReminderSettings,
  saveReminderSettings,
  getNextReminderDate,
  calculateMillisecondsUntilNextReminder,
  scheduleDailyReminder,
  cancelDailyReminder,
  getSchedulerStatus,
} from '../studyReminderScheduler';

describe('studyReminderScheduler', () => {
  let localStorageStore = {};

  beforeEach(() => {
    vi.useFakeTimers();
    localStorageStore = {};
    global.localStorage = {
      getItem: vi.fn((key) => localStorageStore[key] || null),
      setItem: vi.fn((key, value) => {
        localStorageStore[key] = String(value);
      }),
      removeItem: vi.fn((key) => {
        delete localStorageStore[key];
      }),
      clear: vi.fn(() => {
        localStorageStore = {};
      }),
    };
    cancelDailyReminder();
  });

  afterEach(() => {
    cancelDailyReminder();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('getReminderSettings', () => {
    it('returns default settings when storage is empty', () => {
      const settings = getReminderSettings();
      expect(settings.enabled).toBe(false);
      expect(settings.reminderTime).toBe('19:00');
      expect(settings.targetDestination).toBe('/flashcards');
    });

    it('merges stored values with defaults', () => {
      localStorageStore[REMINDER_STORAGE_KEY] = JSON.stringify({
        enabled: true,
        reminderTime: '08:30',
      });

      const settings = getReminderSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.reminderTime).toBe('08:30');
      expect(settings.targetDestination).toBe('/flashcards'); // default preserved
    });

    it('handles malformed JSON in localStorage gracefully', () => {
      localStorageStore[REMINDER_STORAGE_KEY] = 'invalid-json{{{';
      const settings = getReminderSettings();
      expect(settings).toEqual(expect.objectContaining(DEFAULT_REMINDER_SETTINGS));
    });
  });

  describe('saveReminderSettings', () => {
    it('persists updates to localStorage', () => {
      const updated = saveReminderSettings({ enabled: true, reminderTime: '20:15' });
      expect(updated.enabled).toBe(true);
      expect(updated.reminderTime).toBe('20:15');
      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        REMINDER_STORAGE_KEY,
        expect.stringContaining('"reminderTime":"20:15"')
      );
    });
  });

  describe('getNextReminderDate', () => {
    it('schedules for today if current time is before reminder time', () => {
      // 10:00 AM reference
      const ref = new Date(2026, 9, 23, 10, 0, 0);
      const next = getNextReminderDate('19:00', ref);

      expect(next.getFullYear()).toBe(2026);
      expect(next.getMonth()).toBe(9);
      expect(next.getDate()).toBe(23); // Same day
      expect(next.getHours()).toBe(19);
      expect(next.getMinutes()).toBe(0);
    });

    it('schedules for tomorrow if current time is after reminder time', () => {
      // 21:00 PM reference (9 PM is after 7 PM)
      const ref = new Date(2026, 9, 23, 21, 0, 0);
      const next = getNextReminderDate('19:00', ref);

      expect(next.getDate()).toBe(24); // Next day
      expect(next.getHours()).toBe(19);
      expect(next.getMinutes()).toBe(0);
    });
  });

  describe('calculateMillisecondsUntilNextReminder', () => {
    it('calculates exact difference in milliseconds', () => {
      const ref = new Date(2026, 9, 23, 18, 0, 0); // 1 hour before 19:00
      const ms = calculateMillisecondsUntilNextReminder('19:00', ref);
      expect(ms).toBe(3600 * 1000);
    });
  });

  describe('scheduleDailyReminder & cancelDailyReminder', () => {
    it('does not schedule timer if disabled', () => {
      saveReminderSettings({ enabled: false });
      const timerId = scheduleDailyReminder();
      expect(timerId).toBeNull();
    });

    it('triggers callback and reschedules when timer expires', () => {
      saveReminderSettings({ enabled: true, reminderTime: '19:00' });
      const mockTrigger = vi.fn();

      scheduleDailyReminder(mockTrigger);
      expect(getSchedulerStatus().isScheduled).toBe(true);

      // Fast-forward time past the reminder
      vi.runOnlyPendingTimers();

      expect(mockTrigger).toHaveBeenCalled();
    });

    it('cancels active timer cleanly', () => {
      saveReminderSettings({ enabled: true });
      scheduleDailyReminder();
      expect(getSchedulerStatus().isScheduled).toBe(true);

      cancelDailyReminder();
      expect(getSchedulerStatus().isScheduled).toBe(false);
    });
  });
});
