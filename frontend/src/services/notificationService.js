/**
 * @fileoverview Browser Web Notifications Service for OpenPrep.
 * Handles permission requests, status checks, and notification dispatching
 * with focus-and-redirect behavior.
 */

export const NOTIFICATION_DESTINATIONS = [
  { value: '/flashcards', label: 'Flashcard Reviews' },
  { value: '/planner', label: 'Study Planner' },
  { value: '/quiz', label: 'Daily Quiz' },
  { value: '/tasks', label: 'Daily Tasks' },
];

/**
 * Checks if the browser supports the Web Notifications API.
 * @returns {boolean}
 */
export const isNotificationSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

/**
 * Gets the current notification permission state.
 * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
 */
export const getNotificationPermission = () => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
};

/**
 * Requests permission from the user to display notifications.
 * @returns {Promise<'granted' | 'denied' | 'default' | 'unsupported'>}
 */
export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    // Callback fallback for legacy browsers
    return new Promise((resolve) => {
      Notification.requestPermission((perm) => {
        resolve(perm || 'denied');
      });
    });
  }
};

/**
 * Dispatches a native browser desktop notification.
 * 
 * @param {string} title
 * @param {Object} [options={}]
 * @param {string} [options.body]
 * @param {string} [options.icon]
 * @param {string} [options.tag]
 * @param {string} [options.url] Target URL to navigate when clicked
 * @param {boolean} [options.requireInteraction]
 * @returns {Notification|null}
 */
export const sendStudyNotification = (title, options = {}) => {
  if (!isNotificationSupported()) {
    console.warn('[NotificationService] Notifications are not supported in this environment.');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn(`[NotificationService] Notification permission is "${Notification.permission}", cannot dispatch.`);
    return null;
  }

  const notificationTitle = title || 'OpenPrep Study Reminder 📚';
  const targetUrl = options.url || '/flashcards';

  const notificationOptions = {
    body: options.body || "It's time for your daily study session! Keep your streak alive.",
    icon: options.icon || '/favicon.ico',
    tag: options.tag || 'openprep-daily-study-reminder',
    requireInteraction: options.requireInteraction ?? false,
    data: {
      url: targetUrl,
      timestamp: Date.now(),
      ...options.data,
    },
  };

  try {
    const notification = new Notification(notificationTitle, notificationOptions);

    notification.onclick = (event) => {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }

      if (typeof window !== 'undefined') {
        window.focus();
        if (targetUrl) {
          window.location.href = targetUrl;
        }
      }

      if (typeof notification.close === 'function') {
        notification.close();
      }
    };

    return notification;
  } catch (error) {
    console.error('[NotificationService] Failed to create Notification:', error);
    return null;
  }
};

/**
 * Sends an instant test notification to verify notification permissions and display.
 * @param {string} [targetUrl='/flashcards']
 * @returns {Notification|null}
 */
export const sendTestNotification = (targetUrl = '/flashcards') => {
  return sendStudyNotification('OpenPrep Test Notification 🔔', {
    body: 'Study reminders are active and working! Click this notification to open your study view.',
    url: targetUrl,
    tag: 'openprep-test-notification',
  });
};
