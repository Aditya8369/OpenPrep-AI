import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ActiveSessionsList from './ActiveSessionsList';
import * as api from '../../services/api';

vi.mock('../../services/api', () => ({
  getActiveSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllOtherSessions: vi.fn(),
}));

const mockSessionList = [
  {
    id: 'sess-curr-1',
    deviceFingerprint: { deviceType: 'desktop', browser: 'Chrome', os: 'Windows' },
    ipAddress: '103.21.244.1',
    geoCountry: 'IN',
    geoCity: 'Mumbai',
    isCurrent: true,
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'sess-remote-2',
    deviceFingerprint: { deviceType: 'mobile', browser: 'Safari', os: 'iOS' },
    ipAddress: '81.2.69.142',
    geoCountry: 'GB',
    geoCity: 'London',
    isCurrent: false,
    lastActiveAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
];

describe('ActiveSessionsList Component (#2326)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders active sessions with current device highlighted', async () => {
    api.getActiveSessions.mockResolvedValueOnce({
      data: {
        success: true,
        currentSessionId: 'sess-curr-1',
        sessions: mockSessionList,
      },
    });

    render(<ActiveSessionsList />);

    await waitFor(() => {
      expect(screen.getByText(/Active Devices & Concurrent Sessions/i)).toBeInTheDocument();
    });

    // Current session device
    expect(screen.getByText(/Chrome on Windows/i)).toBeInTheDocument();
    expect(screen.getByText(/This Device/i)).toBeInTheDocument();
    expect(screen.getByText(/Mumbai, IN/i)).toBeInTheDocument();

    // Remote session device
    expect(screen.getByText(/Safari on iOS/i)).toBeInTheDocument();
    expect(screen.getByText(/Remote Device/i)).toBeInTheDocument();
    expect(screen.getByText(/London, GB/i)).toBeInTheDocument();

    // Revoke button only present on remote session
    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    expect(revokeButtons.length).toBe(1);
  });

  it('revokes remote session when clicking Revoke button', async () => {
    api.getActiveSessions.mockResolvedValueOnce({
      data: {
        success: true,
        currentSessionId: 'sess-curr-1',
        sessions: mockSessionList,
      },
    });

    api.revokeSession.mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Session revoked successfully',
      },
    });

    render(<ActiveSessionsList />);

    await waitFor(() => {
      expect(screen.getByText(/Safari on iOS/i)).toBeInTheDocument();
    });

    const revokeBtn = screen.getByRole('button', { name: /revoke/i });
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(api.revokeSession).toHaveBeenCalledWith('sess-remote-2');
      expect(screen.getByText(/Session terminated successfully/i)).toBeInTheDocument();
    });

    // Remote session removed from DOM
    expect(screen.queryByText(/Safari on iOS/i)).not.toBeInTheDocument();
    // Current session still present
    expect(screen.getByText(/Chrome on Windows/i)).toBeInTheDocument();
  });

  it('logs out of all other devices when clicking Log Out Other Devices', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    api.getActiveSessions.mockResolvedValueOnce({
      data: {
        success: true,
        currentSessionId: 'sess-curr-1',
        sessions: mockSessionList,
      },
    });

    api.revokeAllOtherSessions.mockResolvedValueOnce({
      data: {
        success: true,
        revokedCount: 1,
      },
    });

    render(<ActiveSessionsList />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Log Out Other Devices/i })).toBeInTheDocument();
    });

    const logoutOthersBtn = screen.getByRole('button', { name: /Log Out Other Devices/i });
    fireEvent.click(logoutOthersBtn);

    await waitFor(() => {
      expect(api.revokeAllOtherSessions).toHaveBeenCalled();
      expect(screen.getByText(/Logged out of other devices successfully/i)).toBeInTheDocument();
    });

    // Remote session removed
    expect(screen.queryByText(/Safari on iOS/i)).not.toBeInTheDocument();
  });

  it('displays empty state when no active sessions are returned', async () => {
    api.getActiveSessions.mockResolvedValueOnce({
      data: {
        success: true,
        sessions: [],
      },
    });

    render(<ActiveSessionsList />);

    await waitFor(() => {
      expect(screen.getByText(/No active sessions recorded/i)).toBeInTheDocument();
    });
  });

  it('displays error banner if fetching fails', async () => {
    api.getActiveSessions.mockRejectedValueOnce({
      response: { data: { error: 'Unauthorized to view sessions' } },
    });

    render(<ActiveSessionsList />);

    await waitFor(() => {
      expect(screen.getByText(/Unauthorized to view sessions/i)).toBeInTheDocument();
    });
  });
});
