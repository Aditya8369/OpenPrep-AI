import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DerivationViewer from './DerivationViewer';

// Mock MathRenderer to simplify testing without full unified/remark pipeline
vi.mock('../common/MathRenderer', () => ({
  default: ({ content }) => <div data-testid="math-renderer">{content}</div>,
}));

describe('DerivationViewer', () => {
  const sampleResult = {
    isStemContent: true,
    problemStatement: 'Calculate velocity $v$ for free fall from height $h = 5\\text{ m}$.',
    diagramDescription: 'Vertical fall diagram',
    knownVariables: [
      { symbol: 'm', value: '2\\text{ kg}', description: 'Mass' },
      { symbol: 'h', value: '5\\text{ m}', description: 'Height' },
    ],
    targetUnknown: { symbol: 'v', description: 'Impact Velocity' },
    governingLaws: ['Conservation of Energy: $E_i = E_f$'],
    derivationSteps: [
      {
        stepNumber: 1,
        title: 'Energy Balance',
        latex: 'mgh = \\frac{1}{2}mv^2',
        explanation: 'Initial potential energy turns entirely to kinetic energy.',
        whyStepHappened: 'Gravity is conservative and air resistance is negligible.',
      },
      {
        stepNumber: 2,
        title: 'Solve for Velocity',
        latex: 'v = \\sqrt{2gh}',
        explanation: 'Multiply by 2, cancel m, and take root.',
        whyStepHappened: 'Algebraic isolation of target variable.',
      },
    ],
    finalAnswer: {
      latex: 'v = 9.90\\text{ m/s}',
      value: '9.90',
      unit: 'm/s',
    },
    pitfallsAndTraps: ['Forgetting square root on velocity'],
    conceptTags: ['Kinematics', 'Energy Conservation'],
  };

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  it('renders transcribed problem statement and diagram description', () => {
    render(<DerivationViewer result={sampleResult} />);
    expect(screen.getByText(/Transcribed Problem Statement/i)).toBeInTheDocument();
    expect(screen.getByText(/Vertical fall diagram/i)).toBeInTheDocument();
  });

  it('renders known variables and target unknown', () => {
    render(<DerivationViewer result={sampleResult} />);
    expect(screen.getByText(/Identified Parameters & Knowns/i)).toBeInTheDocument();
    expect(screen.getByText(/Mass/i)).toBeInTheDocument();
    expect(screen.getByText(/Impact Velocity/i)).toBeInTheDocument();
  });

  it('renders derivation steps with expandable intuition tooltip', () => {
    render(<DerivationViewer result={sampleResult} />);
    expect(screen.getByText(/Energy Balance/i)).toBeInTheDocument();
    expect(screen.getByText(/Solve for Velocity/i)).toBeInTheDocument();

    const whyButtons = screen.getAllByText(/Why did this step happen\?/i);
    expect(whyButtons.length).toBe(2);

    // Click first "Why did this step happen?"
    fireEvent.click(whyButtons[0]);
    expect(
      screen.getByText(/Gravity is conservative and air resistance is negligible/i)
    ).toBeInTheDocument();
  });

  it('collapses and expands derivation steps on header click', () => {
    render(<DerivationViewer result={sampleResult} />);
    const stepHeader = screen.getByText(/Energy Balance/i);

    // Steps start expanded
    expect(
      screen.getByText(/Initial potential energy turns entirely to kinetic energy/i)
    ).toBeInTheDocument();

    // Click header to collapse
    fireEvent.click(stepHeader);
    expect(
      screen.queryByText(/Initial potential energy turns entirely to kinetic energy/i)
    ).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(stepHeader);
    expect(
      screen.getByText(/Initial potential energy turns entirely to kinetic energy/i)
    ).toBeInTheDocument();
  });

  it('renders final derived answer and pitfalls', () => {
    render(<DerivationViewer result={sampleResult} />);
    expect(screen.getByText(/Final Derived Solution/i)).toBeInTheDocument();
    expect(screen.getByText(/Unit: m\/s/i)).toBeInTheDocument();
    expect(screen.getByText(/Forgetting square root on velocity/i)).toBeInTheDocument();
  });

  it('copies full derivation when Copy Markdown is clicked', () => {
    render(<DerivationViewer result={sampleResult} />);
    const copyBtn = screen.getByText(/Copy Markdown/i);
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
