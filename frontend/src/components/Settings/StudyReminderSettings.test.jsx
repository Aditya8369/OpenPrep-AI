import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import StudyReminderSettings from './StudyReminderSettings';
import * as notificationService from '../../services/notificationService';
import * as scheduler from '../../services/studyReminderScheduler';

describe('StudyReminderSettings Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders title and toggle button with initial disabled state', () => {
    render(<StudyReminderSettings />);

    expect(screen.getByText('Daily Study Reminders')).toBeInTheDocument();
    expect(screen.getByText(/Get desktop alerts at your preferred time/i)).toBeInTheDocument();
    const toggle = screen.getByTestId('reminder-toggle-btn');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('shows permission prompt when permission is default', () => {
    vi.spyOn(notificationService, 'getNotificationPermission').mockReturnValue('default');
    render(<StudyReminderSettings />);

    expect(screen.getByTestId('permission-request-alert')).toBeInTheDocument();
    expect(screen.getByTestId('grant-permission-btn')).toBeInTheDocument();
  });

  it('shows denied alert when browser blocks notifications', () => {
    vi.spyOn(notificationService, 'getNotificationPermission').mockReturnValue('denied');
    render(<StudyReminderSettings />);

    expect(screen.getByTestId('denied-alert')).toBeInTheDocument();
    expect(screen.getByText(/Notifications Blocked by Browser/i)).toBeInTheDocument();
  });

  it('enables reminder form controls when toggle is clicked and permission is granted', async () => {
    vi.spyOn(notificationService, 'getNotificationPermission').mockReturnValue('granted');
    render(<StudyReminderSettings />);

    const toggle = screen.getByTestId('reminder-toggle-btn');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('reminder-time-input')).toBeInTheDocument();
      expect(screen.getByTestId('target-destination-select')).toBeInTheDocument();
    });
  });

  it('updates reminder time when preset button is clicked', async () => {
    vi.spyOn(notificationService, 'getNotificationPermission').mockReturnValue('granted');
    vi.spyOn(scheduler, 'getReminderSettings').mockReturnValue({
      enabled: true,
      reminderTime: '19:00',
      targetDestination: '/flashcards',
      timezone: 'UTC',
    });

    render(<StudyReminderSettings />);

    const morningPreset = screen.getByTestId('preset-08:00');
    fireEvent.click(morningPreset);

    const timeInput = screen.getByTestId('reminder-time-input');
    expect(timeInput.value).toBe('08:00');
  });

  it('dispatches test notification when "Send Test Notification" is clicked', async () => {
    vi.spyOn(notificationService, 'getNotificationPermission').mockReturnValue('granted');
    const sendTestSpy = vi.spyOn(notificationService, 'sendTestNotification').mockReturnValue({
      title: 'OpenPrep Test Notification 🔔',
      close: vi.fn(),
    });

    render(<StudyReminderSettings />);

    const testBtn = screen.getByTestId('send-test-notification-btn');
    fireEvent.click(testBtn);

    expect(sendTestSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('test-feedback-message')).toBeInTheDocument();
      expect(screen.getByText(/Test notification sent!/i)).toBeInTheDocument();
    });
  });

  it('shows unsupported alert when browser does not support notifications', () => {
    vi.spyOn(notificationService, 'isNotificationSupported').mockReturnValue(false);
    render(<StudyReminderSettings />);

    expect(screen.getByTestId('unsupported-alert')).toBeInTheDocument();
    expect(screen.getByText(/Notifications Not Supported/i)).toBeInTheDocument();
  });
});
