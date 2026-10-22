import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import GraphSandbox from './GraphSandbox';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(function () {
      return {
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        render: vi.fn(),
        dispose: vi.fn(),
        domElement: document.createElement('canvas'),
      };
    }),
  };
});

describe('GraphSandbox Component', () => {
  beforeEach(() => {
    // Mock Canvas 2D context
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
    });
  });

  const defaultProps = {
    equations: [
      { id: 'eq-1', formula: 'sin(x)', color: '#6366f1', visible: true, type: 'explicit' },
    ],
    activeDimension: '2D',
    sliders: { k: 1, m: 1 },
    isAnimating: false,
  };

  it('renders 2D canvas and viewport controls toolbar', () => {
    render(<GraphSandbox {...defaultProps} />);
    expect(screen.getByTitle('Zoom In')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom Out')).toBeInTheDocument();
    expect(screen.getByTitle('Reset Viewport to (-10, 10)')).toBeInTheDocument();
    expect(screen.getByTitle('Toggle Coordinate Grid')).toBeInTheDocument();
    expect(screen.getByTitle('Toggle Roots / Zeros Detection')).toBeInTheDocument();
    expect(screen.getByTitle('Toggle Interactive Tangent Line & Derivative')).toBeInTheDocument();
  });

  it('renders coordinate inspection hint', () => {
    render(<GraphSandbox {...defaultProps} />);
    expect(screen.getByText('Hover canvas to inspect (x, y)')).toBeInTheDocument();
  });

  it('renders 3D mode message when activeDimension is 3D', () => {
    render(<GraphSandbox {...defaultProps} activeDimension="3D" />);
    expect(screen.getByText('3D Orbit: Click & drag to rotate | Scroll to zoom')).toBeInTheDocument();
  });
});
