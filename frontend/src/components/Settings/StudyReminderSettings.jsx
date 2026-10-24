/**
 * @fileoverview Settings component for managing timezone-aware daily study reminders.
 * Allows users to toggle notifications, pick their preferred study time,
 * select a target study destination, and dispatch test notifications.
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  Clock,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  NOTIFICATION_DESTINATIONS,
} from '../../services/notificationService';
import {
  getReminderSettings,
  saveReminderSettings,
  getNextReminderDate,
} from '../../services/studyReminderScheduler';

const TIME_PRESETS = [
  { label: 'Morning', time: '08:00' },
  { label: 'Afternoon', time: '14:00' },
  { label: 'Evening', time: '19:00' },
  { label: 'Night', time: '21:30' },
];

export const StudyReminderSettings = () => {
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState('default');
  const [settings, setSettings] = useState(getReminderSettings);
  const [testStatus, setTestStatus] = useState(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  useEffect(() => {
    const isSupp = isNotificationSupported();
    setSupported(isSupp);
    if (isSupp) {
      setPermission(getNotificationPermission());
    }
  }, []);

  const handleToggleEnable = async () => {
    if (!settings.enabled && permission !== 'granted') {
      setIsRequestingPermission(true);
      const perm = await requestNotificationPermission();
      setPermission(perm);
      setIsRequestingPermission(false);

      if (perm !== 'granted') {
        return;
      }
    }

    const updated = saveReminderSettings({ enabled: !settings.enabled });
    setSettings(updated);
  };

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    const perm = await requestNotificationPermission();
    setPermission(perm);
    setIsRequestingPermission(false);
  };

  const handleTimeChange = (newTime) => {
    const updated = saveReminderSettings({ reminderTime: newTime });
    setSettings(updated);
  };

  const handleDestinationChange = (e) => {
    const updated = saveReminderSettings({ targetDestination: e.target.value });
    setSettings(updated);
  };

  const handleSendTest = () => {
    if (permission !== 'granted') {
      setTestStatus({
        type: 'error',
        message: 'Please grant browser notification permission first.',
      });
      return;
    }

    const notification = sendTestNotification(settings.targetDestination);
    if (notification) {
      setTestStatus({
        type: 'success',
        message: 'Test notification sent! Check your desktop notifications.',
      });
    } else {
      setTestStatus({
        type: 'error',
        message: 'Failed to send notification. Check browser settings.',
      });
    }

    setTimeout(() => setTestStatus(null), 5000);
  };

  const nextReminder = settings.enabled ? getNextReminderDate(settings.reminderTime) : null;

  return (
    <div
      data-testid="study-reminder-settings"
      className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6 text-gray-900 dark:text-gray-100"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <BellRing className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Daily Study Reminders
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Get desktop alerts at your preferred time so you never miss a review session.
            </p>
          </div>
        </div>

        {/* Enable / Disable Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          aria-label="Toggle Daily Study Reminders"
          data-testid="reminder-toggle-btn"
          disabled={!supported}
          onClick={handleToggleEnable}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 ${
            settings.enabled ? 'bg-amber-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Unsupported Warning */}
      {!supported && (
        <div
          data-testid="unsupported-alert"
          className="p-4 rounded-xl bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300"
        >
          <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-800 dark:text-gray-200">
              Notifications Not Supported
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your browser or environment does not support the Web Notifications API.
            </p>
          </div>
        </div>
      )}

      {/* Permission Status Alerts */}
      {supported && permission === 'denied' && (
        <div
          data-testid="denied-alert"
          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3 text-sm text-red-800 dark:text-red-200"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Notifications Blocked by Browser</p>
            <p className="text-xs text-red-700 dark:text-red-300">
              Desktop notifications are blocked. To receive study reminders, click the padlock or
              settings icon next to your browser's address bar and set <strong>Notifications</strong> to{' '}
              <strong>Allow</strong>.
            </p>
          </div>
        </div>
      )}

      {supported && permission === 'default' && (
        <div
          data-testid="permission-request-alert"
          className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-sm"
        >
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>Browser notification permission is required to deliver reminders.</span>
          </div>
          <button
            type="button"
            onClick={handleRequestPermission}
            disabled={isRequestingPermission}
            data-testid="grant-permission-btn"
            className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex-shrink-0 shadow-sm"
          >
            {isRequestingPermission ? 'Requesting...' : 'Grant Permission'}
          </button>
        </div>
      )}

      {/* Config Form (visible when enabled) */}
      {settings.enabled && (
        <div className="space-y-5 pt-2 border-t border-gray-100 dark:border-gray-700/60">
          {/* Reminder Time Picker & Presets */}
          <div className="space-y-2">
            <label
              htmlFor="reminder-time-input"
              className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2"
            >
              <Clock className="w-4 h-4 text-amber-500" />
              Preferred Daily Study Time
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="reminder-time-input"
                data-testid="reminder-time-input"
                type="time"
                value={settings.reminderTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.time}
                    type="button"
                    onClick={() => handleTimeChange(preset.time)}
                    data-testid={`preset-${preset.time}`}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      settings.reminderTime === preset.time
                        ? 'bg-amber-500 text-white font-medium'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {preset.label} ({preset.time})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Target Destination Dropdown */}
          <div className="space-y-2">
            <label
              htmlFor="target-destination-select"
              className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4 text-amber-500" />
              Target Study View When Clicked
            </label>
            <select
              id="target-destination-select"
              data-testid="target-destination-select"
              value={settings.targetDestination}
              onChange={handleDestinationChange}
              className="w-full sm:w-72 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none text-gray-900 dark:text-gray-100"
            >
              {NOTIFICATION_DESTINATIONS.map((dest) => (
                <option key={dest.value} value={dest.value}>
                  {dest.label} ({dest.value})
                </option>
              ))}
            </select>
          </div>

          {/* Timezone & Next Scheduled Status */}
          <div className="p-3.5 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Globe className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span>
                Local Timezone: <strong>{settings.timezone}</strong>
              </span>
            </div>

            {nextReminder && (
              <div
                data-testid="next-reminder-badge"
                className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  Next Reminder:{' '}
                  {nextReminder.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  at {settings.reminderTime}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test Notification Action */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <CheckCircle2
            className={`w-4 h-4 ${
              permission === 'granted' ? 'text-green-500' : 'text-gray-400'
            }`}
          />
          <span>
            Permission Status:{' '}
            <strong className="capitalize">{permission}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={handleSendTest}
          data-testid="send-test-notification-btn"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          Send Test Notification
        </button>
      </div>

      {/* Feedback banner for test notification */}
      {testStatus && (
        <div
          data-testid="test-feedback-message"
          className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
            testStatus.type === 'success'
              ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {testStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{testStatus.message}</span>
        </div>
      )}
    </div>
  );
};

export default StudyReminderSettings;
