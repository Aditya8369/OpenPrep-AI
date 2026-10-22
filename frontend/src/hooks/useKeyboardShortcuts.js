import { useEffect, useRef } from 'react';

export function isTypingTarget(element) {
  if (!element) return false;

  const tagName = element.tagName?.toUpperCase();

  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) ||
    element.isContentEditable ||
    element.getAttribute?.('contenteditable') === 'true'
  );
}

export default function useKeyboardShortcuts(
  shortcuts,
  { enabled = true } = {},
) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.isComposing) return;

      const typing = isTypingTarget(event.target);
      const modifierPressed = event.ctrlKey || event.metaKey;

      for (const shortcut of shortcutsRef.current) {
        const keyMatches =
          event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (!keyMatches) continue;

        if (Boolean(shortcut.mod) !== modifierPressed) continue;
        if (event.altKey) continue;

        if (
          !shortcut.mod && 
          shortcut.shift && 
          !event.shiftKey && 
          event.key !== '?'
        ) {
          continue;
        }

        if (typing && !shortcut.allowWhileTyping && !shortcut.mod) {
          continue;
        }

        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }

        shortcut.handler(event);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);
}