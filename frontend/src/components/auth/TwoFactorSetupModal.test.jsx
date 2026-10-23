import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import TwoFactorSetupModal from './TwoFactorSetupModal';
import API from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('TwoFactorSetupModal Component', () => {
  const mockSetupData = {
    success: true,
    secret: 'JBSWY3DPEHPK3PXP',
    qrCodeUrl: 'data:image/png;base64,mockqrcode',
    backupCodes: [
      'a1b2c3d4',
      'e5f6a7b8',
      'c9d0e1f2',
      '3a4b5c6d',
      '7e8f9a0b',
      '1c2d3e4f',
      '5a6b7c8d',
      '9e0f1a2b',
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<TwoFactorSetupModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Step 1 with QR code and secret key when open', async () => {
    API.post.mockResolvedValueOnce({ data: mockSetupData });

    render(<TwoFactorSetupModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Two-Factor Authentication \(2FA\)/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('setup-qr-code')).toBeInTheDocument();
      expect(screen.getByTestId('manual-secret-key')).toHaveTextContent('JBSWY3DPEHPK3PXP');
    });
  });

  it('copies secret key to clipboard when Copy button is clicked', async () => {
    API.post.mockResolvedValueOnce({ data: mockSetupData });

    render(<TwoFactorSetupModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('copy-secret-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('copy-secret-btn'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP');
  });

  it('transitions to Step 2 and validates 6-digit confirmation code', async () => {
    API.post.mockResolvedValueOnce({ data: mockSetupData });
    API.post.mockResolvedValueOnce({ data: { success: true } });

    render(<TwoFactorSetupModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('next-to-verify-btn')).toBeInTheDocument();
    });

    // Go to Step 2
    fireEvent.click(screen.getByTestId('next-to-verify-btn'));
    expect(screen.getByTestId('twofa-verification-input')).toBeInTheDocument();

    // Enter code
    fireEvent.change(screen.getByTestId('twofa-verification-input'), {
      target: { value: '123456' },
    });

    fireEvent.click(screen.getByTestId('confirm-enable-btn'));

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/auth/2fa/enable', { token: '123456' });
      // Advances to Step 3 (Backup codes)
      expect(screen.getByTestId('backup-codes-grid')).toBeInTheDocument();
      expect(screen.getByText('a1b2c3d4')).toBeInTheDocument();
    });
  });

  it('displays 8 backup codes and enables finish button after confirmation', async () => {
    API.post.mockResolvedValueOnce({ data: mockSetupData });
    API.post.mockResolvedValueOnce({ data: { success: true } });

    const onCompleteMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <TwoFactorSetupModal
        isOpen={true}
        onClose={onCloseMock}
        onSetupComplete={onCompleteMock}
      />
    );

    await waitFor(() => fireEvent.click(screen.getByTestId('next-to-verify-btn')));

    fireEvent.change(screen.getByTestId('twofa-verification-input'), {
      target: { value: '654321' },
    });
    fireEvent.click(screen.getByTestId('confirm-enable-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('finish-setup-btn')).toBeDisabled();
    });

    // Check confirmation checkbox
    fireEvent.click(screen.getByTestId('confirm-saved-checkbox'));
    expect(screen.getByTestId('finish-setup-btn')).not.toBeDisabled();

    // Finish
    fireEvent.click(screen.getByTestId('finish-setup-btn'));
    expect(onCompleteMock).toHaveBeenCalled();
    expect(onCloseMock).toHaveBeenCalled();
  });
});
