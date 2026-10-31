import { useState, useEffect, useCallback, useRef } from 'react';
import { splitSentences, findSentenceAt, stripMarkdown } from '../utils/textUtils';
import audioDuckingManager from '../services/audioDuckingManager';

const DEFAULT_RATES = [0.5, 1, 1.25, 1.5];

const supportsSpeech = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

const getSavedSpeed = (fallback = 1) => {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return fallback;
    }
    const saved = localStorage.getItem('openprep_tts_speed');
    const num = parseFloat(saved);
    return Number.isFinite(num) && num > 0 ? num : fallback;
  } catch {
    return fallback;
  }
};

/**
 * The exact string handed to the speech engine, with markdown stripped so
 * symbols like ** asterisks or headers are not read out loud as characters.
 */
const toSpokenContent = (value) => stripMarkdown(value || '').trim();

export function useTextToSpeech(text, { rates = DEFAULT_RATES, initialRate = getSavedSpeed() } = {}) {
  const [supported] = useState(supportsSpeech);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rate, setRate] = useState(() => getSavedSpeed(initialRate));
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(-1);

  const textRef = useRef(text);
  const sentencesRef = useRef(splitSentences(toSpokenContent(text)));
  const rateRef = useRef(rate);

  useEffect(() => {
    rateRef.current = rate;
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem('openprep_tts_speed', String(rate));
      }
    } catch {
      // ignore storage access restrictions
    }
  }, [rate]);

  useEffect(() => {
    textRef.current = text;
    sentencesRef.current = splitSentences(toSpokenContent(text));
  }, [text]);

  // Stop reading whenever the source text changes
  useEffect(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setActiveSentenceIndex(-1);
  }, [text, supported]);

  // Cancel any in-flight speech when the component unmounts
  useEffect(() => {
    if (!supported) return;
    return () => {
      audioDuckingManager.stopDucking('tts');
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [supported]);

  const speak = useCallback(() => {
    if (!supported) return;

    const content = toSpokenContent(textRef.current);
    if (!content) return;

    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setActiveSentenceIndex(-1);

    // Re-derive from `content` rather than trusting the ref: `speak` can be
    // called in the same tick as a text change, before the effect has run.
    const sentences = splitSentences(content);
    sentencesRef.current = sentences;

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = rateRef.current;
    utterance.onboundary = (event) => {
      const index = findSentenceAt(sentencesRef.current, event.charIndex);
      if (index >= 0) setActiveSentenceIndex(index);
    };
    const finish = () => {
      setIsSpeaking(false);
      setActiveSentenceIndex(-1);
      audioDuckingManager.stopDucking('tts');
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    setIsSpeaking(true);
    setActiveSentenceIndex(0);
    audioDuckingManager.startDucking('tts');
    window.speechSynthesis.speak(utterance);
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setActiveSentenceIndex(-1);
    audioDuckingManager.stopDucking('tts');
  }, [supported]);

  const toggle = useCallback(() => {
    if (isSpeaking) stop();
    else speak();
  }, [isSpeaking, speak, stop]);

  const cycleRate = useCallback(() => {
    const currentIndex = rates.indexOf(rateRef.current);
    const next = rates[(currentIndex + 1) % rates.length];
    rateRef.current = next;
    setRate(next);
    if (isSpeaking) speak();
  }, [rates, isSpeaking, speak]);

  return {
    supported,
    isSpeaking,
    rate,
    activeSentenceIndex,
    speak,
    stop,
    toggle,
    cycleRate,
  };
}
