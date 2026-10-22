import React from 'react';

/**
 * SkipToContent Component
 * WCAG 2.1 AAA requirement: Bypass Blocks (Success Criterion 2.4.1).
 * Provides a visible focus-activated skip link for keyboard & screen reader users.
 */
export default function SkipToContent({ targetId = 'main-content' }) {
  const handleClick = (e) => {
    e.preventDefault();
    const target = document.getElementById(targetId) || document.querySelector('main');
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[99999] focus:px-4 focus:py-2.5 focus:bg-amber-500 focus:text-neutral-950 focus:font-extrabold focus:text-sm focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-4 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-black transition-all"
    >
      Skip to main content (Press Enter)
    </a>
  );
}
