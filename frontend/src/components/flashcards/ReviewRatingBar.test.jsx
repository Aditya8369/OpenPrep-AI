import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReviewRatingBar from './ReviewRatingBar';
import API from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('ReviewRatingBar', () => {
  const mockCard = {
    id: 'card-123',
    stability: 4.5,
    fsrsDifficulty: 5.2,
    reps: 2,
    repetitions: 2,
    state: 'review',
    interval: 4,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    API.get.mockResolvedValue({
      data: {
        success: true,
        retrievability: 0.92,
        intervals: {
          again: { days: 0, label: '< 10m' },
          hard: { days: 2, label: '2d' },
          good: { days: 6, label: '6d' },
          easy: { days: 14, label: '14d' },
        },
      },
    });
  });

  it('renders all 4 FSRS rating buttons with labels and shortcut keys', async () => {
    const onRate = vi.fn();
    render(<ReviewRatingBar card={mockCard} onRate={onRate} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Hard/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Good/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Easy/i })).toBeInTheDocument();
    });
  });

  it('displays server-forecasted upcoming interval badges when available', async () => {
    const onRate = vi.fn();
    render(<ReviewRatingBar card={mockCard} onRate={onRate} />);

    await waitFor(() => {
      expect(screen.getByText('6d')).toBeInTheDocument();
      expect(screen.getByText('14d')).toBeInTheDocument();
      expect(screen.getByText('2d')).toBeInTheDocument();
      expect(screen.getByText('< 10m')).toBeInTheDocument();
    });
  });

  it('invokes onRate with quality and rating parameters when clicked', async () => {
    const onRate = vi.fn();
    render(<ReviewRatingBar card={mockCard} onRate={onRate} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Good/i })).toBeInTheDocument();
    });

    const goodBtn = screen.getByRole('button', { name: /^Good/i });
    fireEvent.click(goodBtn);

    expect(onRate).toHaveBeenCalledWith(4, 3); // quality: 4, rating: 3
  });

  it('disables rating buttons when submitting is true', async () => {
    const onRate = vi.fn();
    render(<ReviewRatingBar card={mockCard} onRate={onRate} submitting={true} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Again/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /^Good/i })).toBeDisabled();
    });
  });

  it('allows changing target retention rate', async () => {
    const onRate = vi.fn();
    const onRetentionChange = vi.fn();
    render(
      <ReviewRatingBar
        card={mockCard}
        onRate={onRate}
        targetRetention={0.90}
        onTargetRetentionChange={onRetentionChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/target retention settings/i)).toBeInTheDocument();
    });

    const settingsToggle = screen.getByLabelText(/target retention settings/i);
    fireEvent.click(settingsToggle);

    const btn85 = screen.getByRole('button', { name: '85%' });
    fireEvent.click(btn85);

    expect(onRetentionChange).toHaveBeenCalledWith(0.85);
  });
});
