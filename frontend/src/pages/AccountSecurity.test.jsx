import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AccountSecurity from './AccountSecurity';

vi.mock('../components/security/ActiveSessionsList', () => ({
  default: () => <div data-testid="active-sessions-mock">Mock Active Sessions List</div>,
}));

vi.mock('../components/SecuritySettings', () => ({
  default: () => <div data-testid="security-settings-mock">Mock Security Settings</div>,
}));

describe('AccountSecurity Page (#2326)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = () => {
    return render(
      <MemoryRouter initialEntries={['/security']}>
        <Routes>
          <Route path="/security" element={<AccountSecurity />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders page header and tabs correctly', () => {
    renderPage();

    expect(screen.getByText(/Account Security Center/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Active Sessions & GeoIP/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Passkeys & 2FA/i })).toBeInTheDocument();
    expect(screen.getByTestId('active-sessions-mock')).toBeInTheDocument();
  });

  it('switches to Passkeys & 2FA tab when clicked', () => {
    renderPage();

    const passkeyTab = screen.getByRole('button', { name: /Passkeys & 2FA/i });
    fireEvent.click(passkeyTab);

    expect(screen.getByTestId('security-settings-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('active-sessions-mock')).not.toBeInTheDocument();
  });
});
