import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import useKeyboardShortcuts, { isTypingTarget } from './useKeyboardShortcuts';

afterEach(() => {
  cleanup();
});

function TestComponent({ shortcuts, enabled = true }) {
  useKeyboardShortcuts(shortcuts, { enabled });
  return <div>Keyboard shortcut test</div>;
}

describe('useKeyboardShortcuts', () => {
  it('calls a handler for a matching single-key shortcut', () => {
    const handler = vi.fn();
    const shortcuts = [{ key: 'n', handler }];

    render(<TestComponent shortcuts={shortcuts} />);
    fireEvent.keyDown(document, { key: 'n' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports Ctrl/Cmd modifier shortcuts', () => {
    const handler = vi.fn();
    const shortcuts = [{ key: 'k', mod: true, handler }];

    render(<TestComponent shortcuts={shortcuts} />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores single-key shortcuts while typing in an input', () => {
    const handler = vi.fn();
    const shortcuts = [{ key: 'n', handler }];

    render(
      <>
        <input aria-label="Search" />
        <TestComponent shortcuts={shortcuts} />
      </>,
    );

    fireEvent.keyDown(document.querySelector('input'), { key: 'n' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('allows explicitly permitted shortcuts while typing', () => {
    const handler = vi.fn();
    const shortcuts = [
      { key: 'Escape', allowWhileTyping: true, handler },
    ];

    render(
      <>
        <input aria-label="Search" />
        <TestComponent shortcuts={shortcuts} />
      </>,
    );

    fireEvent.keyDown(document.querySelector('input'), { key: 'Escape' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not call handlers when disabled', () => {
    const handler = vi.fn();
    const shortcuts = [{ key: 'n', handler }];

    render(<TestComponent shortcuts={shortcuts} enabled={false} />);
    fireEvent.keyDown(document, { key: 'n' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('identifies text-entry elements', () => {
    const input = document.createElement('input');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');

    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});