import React, { useState, useEffect } from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';

/**
 * AriaAnnouncer Component
 * Implements accessible WCAG 2.1 AAA live regions for screen readers (NVDA, JAWS, VoiceOver).
 * Provides distinct polite and assertive channels for dynamic timers, flashcard flip states,
 * and background completion alerts.
 */
export default function AriaAnnouncer() {
  const { announcement } = useAccessibility();
  const [eventPolite, setEventPolite] = useState('');
  const [eventAssertive, setEventAssertive] = useState('');

  // Handle global DOM events from anywhere in the app
  useEffect(() => {
    const handleCustomAnnounce = (e) => {
      const { message, priority } = e.detail || {};
      if (!message) return;

      if (priority === 'assertive') {
        setEventAssertive(message);
      } else {
        setEventPolite(message);
      }
    };

    window.addEventListener('openprep:announce', handleCustomAnnounce);
    return () => window.removeEventListener('openprep:announce', handleCustomAnnounce);
  }, []);

  const activePolite = announcement?.priority !== 'assertive' ? (announcement?.message || eventPolite) : eventPolite;
  const activeAssertive = announcement?.priority === 'assertive' ? (announcement?.message || eventAssertive) : eventAssertive;

  return (
    <div
      id="openprep-aria-announcements"
      className="sr-only pointer-events-none"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: '0',
      }}
    >
      {/* Polite Region (Status updates, card flips, timer intervals) */}
      <div
        id="aria-live-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {activePolite}
      </div>

      {/* Assertive Region (Urgent warnings, timer expiry, error alerts) */}
      <div
        id="aria-live-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {activeAssertive}
      </div>
    </div>
  );
}
