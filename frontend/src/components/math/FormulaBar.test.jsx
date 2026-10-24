import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import FormulaBar from './FormulaBar';

describe('FormulaBar Component', () => {
  const defaultProps = {
    equations: [
      { id: 'eq-1', formula: 'sin(x) * exp(-0.1 * x)', visible: true, color: '#6366f1' },
    ],
    onAddEquation: vi.fn(),
    onUpdateEquation: vi.fn(),
    onRemoveEquation: vi.fn(),
    onToggleVisibility: vi.fn(),
    sliders: { k: 2, m: 1 },
    onSliderChange: vi.fn(),
    isAnimating: false,
    onToggleAnimation: vi.fn(),
    onExportPNG: vi.fn(),
    onExportSVG: vi.fn(),
    activeDimension: '2D',
    onDimensionChange: vi.fn(),
  };

  it('renders initial equation and dimension buttons', () => {
    render(<FormulaBar {...defaultProps} />);
    expect(screen.getByText('2D Sandbox')).toBeInTheDocument();
    expect(screen.getByText('3D Space (Three.js)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sin(x) * exp(-0.1 * x)')).toBeInTheDocument();
  });

  it('calls onDimensionChange when switching to 3D Space', () => {
    render(<FormulaBar {...defaultProps} />);
    const btn3D = screen.getByText('3D Space (Three.js)');
    fireEvent.click(btn3D);
    expect(defaultProps.onDimensionChange).toHaveBeenCalledWith('3D');
  });

  it('switches to Sliders tab and updates slider values', () => {
    render(<FormulaBar {...defaultProps} />);
    const slidersTab = screen.getByText('Sliders');
    fireEvent.click(slidersTab);

    expect(screen.getByText('Dynamically manipulate parameters', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText('k').length).toBeGreaterThan(0);
    expect(screen.getAllByText('m').length).toBeGreaterThan(0);
  });

  it('switches to STEM Library presets tab and displays curated equations', () => {
    render(<FormulaBar {...defaultProps} />);
    const libraryTab = screen.getByText('STEM Library');
    fireEvent.click(libraryTab);

    expect(screen.getByText('Calculus & Waves')).toBeInTheDocument();
    expect(screen.getByText('Damped Oscillation')).toBeInTheDocument();
    expect(screen.getByText('Conics & Geometry')).toBeInTheDocument();
  });

  it('triggers onExportPNG and onExportSVG when export buttons are clicked', () => {
    render(<FormulaBar {...defaultProps} />);
    const pngBtn = screen.getByTitle('Export High-Resolution PNG');
    fireEvent.click(pngBtn);
    expect(defaultProps.onExportPNG).toHaveBeenCalled();

    const svgBtn = screen.getByTitle('Export Vector SVG');
    fireEvent.click(svgBtn);
    expect(defaultProps.onExportSVG).toHaveBeenCalled();
  });

  it('toggles formula visibility', () => {
    render(<FormulaBar {...defaultProps} />);
    const toggleBtn = screen.getByTitle('Hide curve');
    fireEvent.click(toggleBtn);
    expect(defaultProps.onToggleVisibility).toHaveBeenCalledWith('eq-1');
  });

  it('calls onAddEquation when Add Another Function button is clicked', () => {
    render(<FormulaBar {...defaultProps} />);
    const addBtn = screen.getByText('Add Another Function or Vector');
    fireEvent.click(addBtn);
    expect(defaultProps.onAddEquation).toHaveBeenCalled();
  });
});
