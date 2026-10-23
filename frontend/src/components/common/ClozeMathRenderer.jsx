import React, { useMemo } from 'react';
import MathRenderer from './MathRenderer';

/**
 * ClozeMathRenderer
 * Renders text containing:
 * 1. Anki cloze syntax: {{c1::answer::hint}} or {{c1::answer}}
 * 2. LaTeX math expressions: $...$ and $$...$$
 *
 * If mode === 'question':
 *   - masks cloze with `[hint]` or `[...]`
 * If mode === 'answer':
 *   - reveals cloze with highlighted styling
 */
const ClozeMathRenderer = ({ text = '', mode = 'question', className = '' }) => {
  const renderedText = useMemo(() => {
    if (!text || typeof text !== 'string') return '';

    // Matches {{c1::answer::hint}} or {{c1::answer}}
    const clozeRegex = /\{\{c\d+::(.*?)(?:::([^}]+))?\}\}/g;

    if (mode === 'question') {
      return text.replace(clozeRegex, (_match, _answer, hint) => {
        return hint ? `**[...${hint}...]**` : `**[...]**`;
      });
    }

    // Answer mode: reveal answer with bold highlight
    return text.replace(clozeRegex, (_match, answer) => {
      return `**${answer}**`;
    });
  }, [text, mode]);

  return <MathRenderer text={renderedText} className={className} />;
};

export default React.memo(ClozeMathRenderer);
