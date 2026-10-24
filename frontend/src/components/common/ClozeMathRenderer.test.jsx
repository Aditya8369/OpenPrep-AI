import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ClozeMathRenderer from './ClozeMathRenderer';

describe('ClozeMathRenderer', () => {
  it('masks cloze deletion in question mode with hint', () => {
    const text = 'The {{c1::hippocampus::brain area}} is crucial for memory.';
    render(<ClozeMathRenderer text={text} mode="question" />);
    expect(screen.getByText(/brain area/i)).toBeInTheDocument();
    expect(screen.queryByText(/hippocampus/i)).not.toBeInTheDocument();
  });

  it('masks cloze deletion without hint as [...] in question mode', () => {
    const text = 'Photosynthesis takes place in {{c1::chloroplasts}}.';
    render(<ClozeMathRenderer text={text} mode="question" />);
    expect(screen.getByText(/\[\.\.\.\]/i)).toBeInTheDocument();
    expect(screen.queryByText(/chloroplasts/i)).not.toBeInTheDocument();
  });

  it('reveals cloze deletion answer in answer mode', () => {
    const text = 'The {{c1::hippocampus::brain area}} is crucial for memory.';
    render(<ClozeMathRenderer text={text} mode="answer" />);
    expect(screen.getByText(/hippocampus/i)).toBeInTheDocument();
  });
});
