import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { AccessibilityProvider, useAccessibility } from './AccessibilityContext';

const TestConsumer = () => {
  const {
    highContrast,
    dyslexicFont,
    reducedMotion,
    colorblindPalette,
    fontSizeScale,
    setHighContrast,
    setDyslexicFont,
    setReducedMotion,
    setColorblindPalette,
    setFontSizeScale,
    announce,
    announcement,
  } = useAccessibility();

  return (
    <div>
      <span data-testid="highContrast">{String(highContrast)}</span>
      <span data-testid="dyslexicFont">{String(dyslexicFont)}</span>
      <span data-testid="reducedMotion">{String(reducedMotion)}</span>
      <span data-testid="colorblindPalette">{colorblindPalette}</span>
      <span data-testid="fontSizeScale">{fontSizeScale}</span>
      <span data-testid="announcementMessage">{announcement.message}</span>

      <button onClick={() => setHighContrast(!highContrast)}>Toggle High Contrast</button>
      <button onClick={() => setDyslexicFont(!dyslexicFont)}>Toggle Dyslexic Font</button>
      <button onClick={() => setReducedMotion(!reducedMotion)}>Toggle Reduced Motion</button>
      <button onClick={() => setColorblindPalette('deuteranopia')}>Set Deuteranopia</button>
      <button onClick={() => setFontSizeScale('large')}>Set Large Font</button>
      <button onClick={() => announce('Quiz timer milestone: 5 minutes left', 'polite')}>
        Announce Timer
      </button>
    </div>
  );
};

describe('AccessibilityContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-high-contrast');
    document.documentElement.removeAttribute('data-dyslexic-font');
    document.documentElement.removeAttribute('data-reduced-motion');
  });

  it('initializes with default values and reflects on root element', () => {
    render(
      <AccessibilityProvider>
        <TestConsumer />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('highContrast').textContent).toBe('false');
    expect(screen.getByTestId('dyslexicFont').textContent).toBe('false');
    expect(screen.getByTestId('colorblindPalette').textContent).toBe('normal');
    expect(screen.getByTestId('fontSizeScale').textContent).toBe('default');
  });

  it('toggles high contrast mode and updates root attributes and localStorage', () => {
    render(
      <AccessibilityProvider>
        <TestConsumer />
      </AccessibilityProvider>
    );

    const toggleBtn = screen.getByText('Toggle High Contrast');
    act(() => {
      toggleBtn.click();
    });

    expect(screen.getByTestId('highContrast').textContent).toBe('true');
    expect(localStorage.getItem('openprep_high_contrast')).toBe('true');
    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true');
    expect(document.documentElement.classList.contains('high-contrast-mode')).toBe(true);
  });

  it('toggles dyslexic font mode and sets data-dyslexic-font', () => {
    render(
      <AccessibilityProvider>
        <TestConsumer />
      </AccessibilityProvider>
    );

    const toggleBtn = screen.getByText('Toggle Dyslexic Font');
    act(() => {
      toggleBtn.click();
    });

    expect(screen.getByTestId('dyslexicFont').textContent).toBe('true');
    expect(localStorage.getItem('openprep_dyslexic_font')).toBe('true');
    expect(document.documentElement.getAttribute('data-dyslexic-font')).toBe('true');
  });

  it('updates colorblind palette and font size scale', () => {
    render(
      <AccessibilityProvider>
        <TestConsumer />
      </AccessibilityProvider>
    );

    act(() => {
      screen.getByText('Set Deuteranopia').click();
      screen.getByText('Set Large Font').click();
    });

    expect(screen.getByTestId('colorblindPalette').textContent).toBe('deuteranopia');
    expect(screen.getByTestId('fontSizeScale').textContent).toBe('large');
    expect(document.documentElement.getAttribute('data-colorblind-palette')).toBe('deuteranopia');
    expect(document.documentElement.getAttribute('data-font-scale')).toBe('large');
  });

  it('announces messages for screen readers and dispatches custom event', () => {
    const eventSpy = vi.fn();
    window.addEventListener('openprep:announce', eventSpy);

    render(
      <AccessibilityProvider>
        <TestConsumer />
      </AccessibilityProvider>
    );

    act(() => {
      screen.getByText('Announce Timer').click();
    });

    expect(screen.getByTestId('announcementMessage').textContent).toBe(
      'Quiz timer milestone: 5 minutes left'
    );
    expect(eventSpy).toHaveBeenCalled();

    window.removeEventListener('openprep:announce', eventSpy);
  });
});
