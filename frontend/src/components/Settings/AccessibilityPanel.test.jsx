import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import AccessibilityPanel from './AccessibilityPanel';
import { AccessibilityProvider } from '../../context/AccessibilityContext';

describe('AccessibilityPanel Component', () => {
  it('renders WCAG 2.1 AAA accessibility title and all option switches', () => {
    render(
      <AccessibilityProvider>
        <AccessibilityPanel />
      </AccessibilityProvider>
    );

    expect(screen.getByText('Accessibility & Assistive Preferences')).toBeInTheDocument();
    expect(screen.getByText('WCAG 2.1 AAA')).toBeInTheDocument();
    expect(screen.getByText('High-Contrast OLED Mode')).toBeInTheDocument();
    expect(screen.getByText('Dyslexia-Friendly Typography')).toBeInTheDocument();
    expect(screen.getByText('Reduced Motion Mode')).toBeInTheDocument();
    expect(screen.getByText('Colorblind-Safe Chart & Data Palettes')).toBeInTheDocument();
    expect(screen.getByText('Text Size Scaling')).toBeInTheDocument();
  });

  it('toggles High-Contrast OLED Mode on click', () => {
    render(
      <AccessibilityProvider>
        <AccessibilityPanel />
      </AccessibilityProvider>
    );

    const highContrastSwitch = screen.getByRole('switch', { name: /toggle high-contrast oled mode/i });
    expect(highContrastSwitch).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(highContrastSwitch);
    expect(highContrastSwitch).toHaveAttribute('aria-checked', 'true');
  });

  it('selects colorblind palettes and font scale options', () => {
    render(
      <AccessibilityProvider>
        <AccessibilityPanel />
      </AccessibilityProvider>
    );

    const deuteranopiaBtn = screen.getByText('Deuteranopia');
    fireEvent.click(deuteranopiaBtn);

    const largeFontBtn = screen.getByText('130% Large');
    fireEvent.click(largeFontBtn);

    expect(document.documentElement.getAttribute('data-colorblind-palette')).toBe('deuteranopia');
    expect(document.documentElement.getAttribute('data-font-scale')).toBe('large');
  });

  it('triggers screen reader speech test button without errors', () => {
    render(
      <AccessibilityProvider>
        <AccessibilityPanel />
      </AccessibilityProvider>
    );

    const testVoiceBtn = screen.getByText(/test screen reader voice/i);
    fireEvent.click(testVoiceBtn);

    expect(screen.getByText(/announcement sent!/i)).toBeInTheDocument();
  });
});
