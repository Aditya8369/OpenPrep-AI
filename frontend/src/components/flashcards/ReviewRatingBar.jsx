import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Sparkles, Sliders, Clock, Target, CheckCircle2, AlertTriangle } from 'lucide-react';
import API from '../../services/api';

/**
 * Default FSRS v4 interval estimator for fast client-side previews
 */
function estimateFsrsIntervals(card, targetRetention = 0.90) {
  const stability = card?.stability || 0;
  const reps = card?.reps || card?.repetitions || 0;
  const factor = Math.log(targetRetention) / Math.log(0.90);

  if (stability <= 0 || reps === 0) {
    // Initial learning steps for new cards
    return {
      again: { days: 0, label: '< 10m' },
      hard: { days: 1, label: '1d' },
      good: { days: Math.max(1, Math.round(3 * factor)), label: `${Math.max(1, Math.round(3 * factor))}d` },
      easy: { days: Math.max(2, Math.round(7 * factor)), label: `${Math.max(2, Math.round(7 * factor))}d` },
    };
  }

  // Next intervals based on stability & retrievability
  const againDays = 1;
  const hardDays = Math.max(1, Math.round(stability * 0.8 * factor));
  const goodDays = Math.max(hardDays + 1, Math.round(stability * 1.5 * factor));
  const easyDays = Math.max(goodDays + 2, Math.round(stability * 2.5 * factor));

  const formatDays = (d) => {
    if (d < 1) return '< 10m';
    if (d < 30) return `${d}d`;
    if (d < 365) return `${(d / 30).toFixed(1)}mo`;
    return `${(d / 365).toFixed(1)}y`;
  };

  return {
    again: { days: againDays, label: formatDays(againDays) },
    hard: { days: hardDays, label: formatDays(hardDays) },
    good: { days: goodDays, label: formatDays(goodDays) },
    easy: { days: easyDays, label: formatDays(easyDays) },
  };
}

/**
 * ReviewRatingBar
 * Next-generation FSRS v4 4-button rating bar with upcoming interval previews,
 * target retention controls, and live memory retrievability indicators.
 */
const ReviewRatingBar = ({
  card,
  onRate,
  submitting = false,
  targetRetention = 0.90,
  onTargetRetentionChange,
  showRetentionSettings = true,
  active = true,
}) => {
  const [serverIntervals, setServerIntervals] = useState(null);
  const [retrievability, setRetrievability] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Fetch server-calculated upcoming intervals for the current card
  useEffect(() => {
    let isCancelled = false;

    if (!active || !card?.id) {
      setServerIntervals(null);
      setRetrievability(null);
      return;
    }

    const fetchIntervals = async () => {
      try {
        const res = await API.get(`/flashcards/${card.id}/intervals?retention=${targetRetention}`);
        if (!isCancelled && res?.data?.success) {
          setServerIntervals(res.data.intervals);
          setRetrievability(res.data.retrievability);
        }
      } catch (err) {
        // Fall back gracefully to client-side FSRS estimator
        if (!isCancelled) {
          setServerIntervals(null);
        }
      }
    };

    fetchIntervals();

    return () => {
      isCancelled = true;
    };
  }, [card?.id, targetRetention, active]);

  // Fallback / client-side estimated intervals
  const estimatedIntervals = useMemo(() => {
    return estimateFsrsIntervals(card, targetRetention);
  }, [card, targetRetention]);

  const intervals = serverIntervals || estimatedIntervals;

  const buttons = [
    {
      rating: 1,
      quality: 1,
      key: '1',
      label: 'Again',
      interval: intervals?.again?.label || '< 10m',
      desc: 'Complete blackout / wrong',
      theme: 'border-rose-300 dark:border-rose-900/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300',
      badgeTheme: 'bg-rose-200/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200',
    },
    {
      rating: 2,
      quality: 2,
      key: '2',
      label: 'Hard',
      interval: intervals?.hard?.label || '1d',
      desc: 'Difficult recall',
      theme: 'border-amber-300 dark:border-amber-900/60 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300',
      badgeTheme: 'bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200',
    },
    {
      rating: 3,
      quality: 4,
      key: '3',
      label: 'Good',
      interval: intervals?.good?.label || '3d',
      desc: 'Successful recall',
      theme: 'border-sky-300 dark:border-sky-900/60 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/30 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300',
      badgeTheme: 'bg-sky-200/80 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200',
    },
    {
      rating: 4,
      quality: 5,
      key: '4',
      label: 'Easy',
      interval: intervals?.easy?.label || '7d',
      desc: 'Effortless recall',
      theme: 'border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
      badgeTheme: 'bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200',
    },
  ];

  const retentionOptions = [0.80, 0.85, 0.90, 0.95];

  return (
    <div className="w-full flex flex-col gap-3" data-testid="fsrs-review-rating-bar">
      {/* Header bar with FSRS Badge & Retrievability */}
      <div className="flex items-center justify-between px-2 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            FSRS v4 Scheduler
          </span>
          {retrievability !== null && (
            <span
              className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono text-[11px]"
              title="Estimated probability of recalling this card right now"
            >
              Retention: {Math.round(retrievability * 100)}%
            </span>
          )}
        </div>

        {showRetentionSettings && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="inline-flex items-center gap-1 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors p-1 rounded"
              title="Configure target retention"
              aria-label="Target retention settings"
            >
              <Target className="w-3.5 h-3.5 text-indigo-500" />
              <span>Target: {Math.round(targetRetention * 100)}%</span>
            </button>
          </div>
        )}
      </div>

      {/* Target Retention Selector Panel */}
      {isSettingsOpen && (
        <div className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 font-medium">
            <Sliders className="w-3.5 h-3.5 text-indigo-500" />
            Desired Retention:
          </span>
          <div className="flex items-center gap-1.5">
            {retentionOptions.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => {
                  if (onTargetRetentionChange) onTargetRetentionChange(rate);
                }}
                className={`px-2.5 py-1 rounded-lg font-mono font-medium transition-all ${
                  targetRetention === rate
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                }`}
              >
                {Math.round(rate * 100)}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4-Button FSRS Rating Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {buttons.map((btn) => (
          <button
            key={btn.rating}
            type="button"
            aria-label={`${btn.label} (Key ${btn.key})`}
            aria-keyshortcuts={btn.key}
            disabled={submitting}
            onClick={() => onRate(btn.quality, btn.rating)}
            className={`group relative py-3.5 px-3 rounded-2xl border flex flex-col items-center justify-between transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${btn.theme}`}
          >
            {/* Forecast Interval Badge */}
            <span
              className={`mb-1.5 px-2 py-0.5 text-[11px] font-mono font-bold rounded-full flex items-center gap-1 tracking-tight ${btn.badgeTheme}`}
              title={`Next review interval if rated ${btn.label}`}
            >
              <Clock className="w-2.5 h-2.5" />
              {btn.interval}
            </span>

            {/* Rating Label */}
            <span className="font-bold text-base sm:text-lg tracking-tight">
              {btn.label}
            </span>

            {/* Keyboard shortcut indicator */}
            <span className="mt-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/5 dark:bg-white/10 opacity-70 group-hover:opacity-100 transition-opacity">
              [{btn.key}]
            </span>
          </button>
        ))}
      </div>

      <div className="text-center text-[11px] text-neutral-400 dark:text-neutral-500">
        Press <kbd className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[10px]">1</kbd> Again, <kbd className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[10px]">2</kbd> Hard, <kbd className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[10px]">3</kbd> Good, <kbd className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[10px]">4</kbd> Easy
      </div>
    </div>
  );
};

ReviewRatingBar.propTypes = {
  card: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    stability: PropTypes.number,
    fsrsDifficulty: PropTypes.number,
    reps: PropTypes.number,
    repetitions: PropTypes.number,
    state: PropTypes.string,
    interval: PropTypes.number,
  }),
  onRate: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
  targetRetention: PropTypes.number,
  onTargetRetentionChange: PropTypes.func,
  showRetentionSettings: PropTypes.bool,
};

export default ReviewRatingBar;
