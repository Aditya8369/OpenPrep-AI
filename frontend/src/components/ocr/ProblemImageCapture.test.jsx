import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProblemImageCapture from './ProblemImageCapture';

describe('ProblemImageCapture', () => {
  it('renders capture controls and initial dropzone', () => {
    render(<ProblemImageCapture onCaptureComplete={vi.fn()} />);

    expect(screen.getByText(/Capture Math or Diagram Problem/i)).toBeInTheDocument();
    expect(screen.getByText(/Choose File/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Camera/i)).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop your math equation/i)).toBeInTheDocument();
    expect(screen.getByText(/Solve Diagram with KaTeX/i)).toBeInTheDocument();
  });

  it('allows changing subject domain selection', () => {
    render(<ProblemImageCapture onCaptureComplete={vi.fn()} />);

    const select = screen.getByRole('combobox');
    expect(select.value).toBe('General STEM');

    fireEvent.change(select, { target: { value: 'Classical & Modern Physics' } });
    expect(select.value).toBe('Classical & Modern Physics');
  });

  it('disables solve button when no image is loaded', () => {
    render(<ProblemImageCapture onCaptureComplete={vi.fn()} />);

    const solveBtn = screen.getByText(/Solve Diagram with KaTeX/i).closest('button');
    expect(solveBtn).toBeDisabled();
  });
});
