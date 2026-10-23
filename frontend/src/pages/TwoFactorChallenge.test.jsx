import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import TwoFactorChallenge from './TwoFactorChallenge';
import API from '../services/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: { tempToken: 'mock-temp-token-jwt', email: 'student@example.com' },
      search: '',
    }),
  };
});

vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
}));

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('TwoFactorChallenge Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders Two-Factor Verification heading and OTP input by default', () => {
    render(
      <MemoryRouter>
        <TwoFactorChallenge />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Two-Factor Verification/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/One-Time Password Input/i)).toBeInTheDocument();
    expect(screen.getByTestId('toggle-backup-mode-btn')).toHaveTextContent(/Use a backup code/i);
  });

  it('toggles to backup recovery code input mode', () => {
    render(
      <MemoryRouter>
        <TwoFactorChallenge />
      </MemoryRouter>
    );

    const toggleBtn = screen.getByTestId('toggle-backup-mode-btn');
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId('backup-code-input')).toBeInTheDocument();
    expect(screen.getByText(/Use Authenticator Code instead/i)).toBeInTheDocument();
  });

  it('submits backup code and navigates to dashboard on successful verification', async () => {
    API.post.mockResolvedValueOnce({
      data: {
        success: true,
        token: 'access-token-xyz',
        sessionId: 'session-123',
      },
    });

    render(
      <MemoryRouter>
        <TwoFactorChallenge />
      </MemoryRouter>
    );

    // Switch to backup code mode
    fireEvent.click(screen.getByTestId('toggle-backup-mode-btn'));

    const input = screen.getByTestId('backup-code-input');
    fireEvent.change(input, { target: { value: 'a1b2c3d4' } });

    fireEvent.click(screen.getByTestId('submit-2fa-verify-btn'));

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/auth/2fa/verify', {
        tempToken: 'mock-temp-token-jwt',
        email: 'student@example.com',
        token: 'a1b2c3d4',
      });
      expect(localStorage.getItem('token')).toBe('access-token-xyz');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('displays error alert when 2FA code is invalid', async () => {
    API.post.mockRejectedValueOnce({
      response: { data: { error: 'Invalid 2FA code or backup code' } },
    });

    render(
      <MemoryRouter>
        <TwoFactorChallenge />
      </MemoryRouter>
    );

    // Switch to backup code mode
    fireEvent.click(screen.getByTestId('toggle-backup-mode-btn'));

    const input = screen.getByTestId('backup-code-input');
    fireEvent.change(input, { target: { value: 'wrong123' } });

    fireEvent.click(screen.getByTestId('submit-2fa-verify-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('challenge-error-alert')).toBeInTheDocument();
      expect(screen.getByText('Invalid 2FA code or backup code')).toBeInTheDocument();
    });
  });
});
