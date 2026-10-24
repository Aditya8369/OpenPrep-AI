import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import AriaAnnouncer from './AriaAnnouncer';
import { AccessibilityProvider } from '../../context/AccessibilityContext';

describe('AriaAnnouncer Component', () => {
  it('renders polite and assertive ARIA live regions with proper roles', () => {
    const { container } = render(
      <AccessibilityProvider>
        <AriaAnnouncer />
      </AccessibilityProvider>
    );

    const politeRegion = container.querySelector('#aria-live-polite');
    const assertiveRegion = container.querySelector('#aria-live-assertive');

    expect(politeRegion).toBeInTheDocument();
    expect(politeRegion).toHaveAttribute('role', 'status');
    expect(politeRegion).toHaveAttribute('aria-live', 'polite');
    expect(politeRegion).toHaveAttribute('aria-atomic', 'true');

    expect(assertiveRegion).toBeInTheDocument();
    expect(assertiveRegion).toHaveAttribute('role', 'alert');
    expect(assertiveRegion).toHaveAttribute('aria-live', 'assertive');
    expect(assertiveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('updates polite region when openprep:announce custom event is fired', () => {
    const { container } = render(
      <AccessibilityProvider>
        <AriaAnnouncer />
      </AccessibilityProvider>
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent('openprep:announce', {
          detail: { message: 'Flipped to definition: Photosynthesis', priority: 'polite' },
        })
      );
    });

    const politeRegion = container.querySelector('#aria-live-polite');
    expect(politeRegion.textContent).toBe('Flipped to definition: Photosynthesis');
  });

  it('updates assertive region when urgent message is dispatched', () => {
    const { container } = render(
      <AccessibilityProvider>
        <AriaAnnouncer />
      </AccessibilityProvider>
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent('openprep:announce', {
          detail: { message: 'Warning: 60 seconds remaining on quiz', priority: 'assertive' },
        })
      );
    });

    const assertiveRegion = container.querySelector('#aria-live-assertive');
    expect(assertiveRegion.textContent).toBe('Warning: 60 seconds remaining on quiz');
  });
});
