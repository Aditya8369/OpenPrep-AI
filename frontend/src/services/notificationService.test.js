import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendStudyNotification,
  sendTestNotification,
  NOTIFICATION_DESTINATIONS,
} from '../notificationService';

describe('notificationService', () => {
  const originalNotification = global.Notification;
  const originalWindow = global.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.Notification = originalNotification;
    global.window = originalWindow;
  });

  describe('isNotificationSupported', () => {
    it('returns true when Notification exists on window', () => {
      global.window = { Notification: class MockNotification {} };
      global.Notification = global.window.Notification;
      expect(isNotificationSupported()).toBe(true);
    });

    it('returns false when window is undefined', () => {
      const savedWindow = global.window;
      // @ts-ignore
      delete global.window;
      expect(isNotificationSupported()).toBe(false);
      global.window = savedWindow;
    });
  });

  describe('getNotificationPermission', () => {
    it('returns Notification.permission when supported', () => {
      class MockNotification {}
      MockNotification.permission = 'granted';
      global.window = { Notification: MockNotification };
      global.Notification = MockNotification;

      expect(getNotificationPermission()).toBe('granted');
    });

    it('returns unsupported when not supported', () => {
      const savedWindow = global.window;
      // @ts-ignore
      delete global.window;
      expect(getNotificationPermission()).toBe('unsupported');
      global.window = savedWindow;
    });
  });

  describe('requestNotificationPermission', () => {
    it('requests permission and resolves with status', async () => {
      class MockNotification {
        static requestPermission() {
          return Promise.resolve('granted');
        }
      }
      global.window = { Notification: MockNotification };
      global.Notification = MockNotification;

      const result = await requestNotificationPermission();
      expect(result).toBe('granted');
    });

    it('falls back to callback syntax if promise rejects', async () => {
      class MockNotification {
        static requestPermission(cb) {
          if (cb) {
            cb('denied');
            return;
          }
          return Promise.reject(new Error('Promise not supported'));
        }
      }
      global.window = { Notification: MockNotification };
      global.Notification = MockNotification;

      const result = await requestNotificationPermission();
      expect(result).toBe('denied');
    });
  });

  describe('sendStudyNotification', () => {
    it('creates a new notification when permission is granted', () => {
      let createdInstance = null;
      class MockNotification {
        static permission = 'granted';
        constructor(title, options) {
          this.title = title;
          this.options = options;
          createdInstance = this;
        }
        close = vi.fn();
      }
      global.window = {
        Notification: MockNotification,
        focus: vi.fn(),
        location: { href: '' },
      };
      global.Notification = MockNotification;

      const notification = sendStudyNotification('Study Alert', {
        body: 'Time to study!',
        url: '/planner',
      });

      expect(notification).not.toBeNull();
      expect(createdInstance.title).toBe('Study Alert');
      expect(createdInstance.options.body).toBe('Time to study!');
      expect(createdInstance.options.data.url).toBe('/planner');

      // Test click handler
      const mockEvent = { preventDefault: vi.fn() };
      createdInstance.onclick(mockEvent);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(global.window.focus).toHaveBeenCalled();
      expect(global.window.location.href).toBe('/planner');
      expect(createdInstance.close).toHaveBeenCalled();
    });

    it('returns null if permission is not granted', () => {
      class MockNotification {
        static permission = 'denied';
      }
      global.window = { Notification: MockNotification };
      global.Notification = MockNotification;

      const notification = sendStudyNotification('Study Alert');
      expect(notification).toBeNull();
    });
  });

  describe('sendTestNotification', () => {
    it('calls sendStudyNotification with test payload', () => {
      let createdTitle = '';
      class MockNotification {
        static permission = 'granted';
        constructor(title) {
          createdTitle = title;
        }
      }
      global.window = { Notification: MockNotification, focus: vi.fn() };
      global.Notification = MockNotification;

      sendTestNotification('/flashcards');
      expect(createdTitle).toContain('Test Notification');
    });
  });

  describe('NOTIFICATION_DESTINATIONS', () => {
    it('contains valid study routes', () => {
      expect(NOTIFICATION_DESTINATIONS).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: '/flashcards' }),
          expect.objectContaining({ value: '/planner' }),
          expect.objectContaining({ value: '/quiz' }),
        ])
      );
    });
  });
});
