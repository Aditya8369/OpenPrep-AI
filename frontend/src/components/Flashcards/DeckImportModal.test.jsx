import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import DeckImportModal from './DeckImportModal';
import API from '../../services/api';

vi.mock('../../services/api.js', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('DeckImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open with Anki and Quizlet tabs', () => {
    render(<DeckImportModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Bi-Directional Deck Importer')).toBeInTheDocument();
    expect(screen.getByText('Anki Package (.apkg)')).toBeInTheDocument();
    expect(screen.getByText(/Quizlet/i)).toBeInTheDocument();
  });

  it('switches to Quizlet tab and parses pasted text preview with cloze detection', async () => {
    render(<DeckImportModal isOpen={true} onClose={vi.fn()} />);

    // Switch to quizlet tab
    fireEvent.click(screen.getByText(/Quizlet/i));

    // Find textarea and type TSV input with cloze
    const textarea = screen.getByPlaceholderText(/Term 1/i);
    fireEvent.change(textarea, {
      target: {
        value: 'Cardiac output\tVolume of blood pumped by the {{c1::left ventricle::chamber}} per minute\nStroke volume\tVolume pumped per beat',
      },
    });

    expect(await screen.findByText(/1 Cloze Deletion/i)).toBeInTheDocument();
    const matchingElements = screen.getAllByText(/Cardiac output/i);
    expect(matchingElements.length).toBeGreaterThan(0);
  });

  it('calls /api/decks/import/quizlet when Quizlet text is submitted', async () => {
    API.post.mockResolvedValueOnce({
      data: { success: true, message: 'Imported 2 cards', count: 2 },
    });

    const onImportSuccess = vi.fn();
    render(<DeckImportModal isOpen={true} onClose={vi.fn()} onImportSuccess={onImportSuccess} />);

    // Switch to quizlet tab
    fireEvent.click(screen.getByText(/Quizlet/i));

    const textarea = screen.getByPlaceholderText(/Term 1/i);
    fireEvent.change(textarea, {
      target: { value: 'Cell\tBasic unit of life' },
    });

    const importBtn = screen.getByRole('button', { name: /Start Import/i });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith(
        '/decks/import/quizlet',
        expect.objectContaining({
          text: 'Cell\tBasic unit of life',
        }),
        expect.any(Object)
      );
    });
  });
});
