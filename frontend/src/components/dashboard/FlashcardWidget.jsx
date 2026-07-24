import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, AlertCircle, RefreshCw, BookOpen, ChevronRight } from 'lucide-react';

const Shimmer = ({ className = '' }) => (
  <div className={`animate-pulse bg-neutral-300/60 rounded ${className}`} />
);

const FlashcardWidget = ({ flashcard = null, loading = false, error = null, totalDue = 0, onRetry, onReview }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // Reset flip state when the flashcard changes (after render, not during)
  useEffect(() => {
    if (isFlipped) setIsFlipped(false);
  }, [flashcard]);

  if (loading) {
    return (
      <div className="relative w-full h-48 cursor-pointer perspective-1000">
        <div className="w-full h-full bg-white shadow-md border border-neutral-300 rounded-sm p-6 flex flex-col justify-center items-center">
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <Shimmer className="w-3 h-3" />
            <Shimmer className="h-3 w-16" />
          </div>
          <Shimmer className="h-5 w-3/4 mb-2" />
          <Shimmer className="h-5 w-1/2" />
          <Shimmer className="h-3 w-20 absolute bottom-2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full h-48 cursor-pointer perspective-1000">
        <div className="w-full h-full bg-white shadow-md border border-neutral-300 rounded-sm p-6 flex flex-col justify-center items-center">
          <AlertCircle className="w-8 h-8 text-neutral-400 mb-2" />
          <p className="text-sm text-neutral-500 text-center mb-3">Could not load cards</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-yellow-700 hover:text-yellow-800 font-semibold text-xs uppercase tracking-wider"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!flashcard) {
    return (
      <div className="relative w-full h-48 cursor-pointer perspective-1000">
        <div className="w-full h-full bg-white shadow-md border border-neutral-300 rounded-sm p-6 flex flex-col justify-center items-center">
          <BookOpen className="w-10 h-10 text-neutral-300 mb-2" />
          <p className="text-sm text-neutral-500 italic text-center">
            {totalDue === 0 ? 'All caught up! No cards due.' : 'No due flashcards'}
          </p>
        </div>
      </div>
    );
  }

  const handleRatingClick = (e, quality) => {
    e.stopPropagation();
    if (onReview) {
      onReview(quality);
    }
  };

  return (
    <div className="relative w-full h-56 cursor-pointer perspective-1000" onClick={() => setIsFlipped(!isFlipped)}>
      <motion.div
        className="w-full h-full relative preserve-3d"
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 200, damping: 20 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front of Card */}
        <div
          className="absolute inset-0 bg-white shadow-md border border-neutral-300 rounded-sm p-6 flex flex-col justify-center items-center backface-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute top-2 left-2 flex items-center text-xs font-bold text-yellow-600 uppercase tracking-widest">
            <Lightbulb className="w-3 h-3 mr-1" />
            Due Cards
            {totalDue > 1 && (
              <span className="ml-1 text-neutral-400 normal-case font-normal tracking-normal">
                ({totalDue} due)
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold font-inter text-neutral-800 text-center leading-snug">
            {flashcard.front}
          </h3>
          <p className="absolute bottom-2 text-xs text-neutral-400 italic">Click to flip</p>
        </div>

        {/* Back of Card */}
        <div
          className="absolute inset-0 bg-yellow-50 shadow-md border border-yellow-200 rounded-sm p-5 flex flex-col justify-between items-center text-center overflow-y-auto"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="w-full flex justify-between items-center text-xs text-yellow-700">
            <span className="font-semibold uppercase tracking-wider">Answer</span>
            <span className="text-neutral-400 italic">Click to flip back</span>
          </div>
          <p className="text-sm text-neutral-800 font-inter leading-relaxed my-2">
            {flashcard.back}
          </p>
          <div className="w-full grid grid-cols-4 gap-1 mt-1">
            <button
              onClick={(e) => handleRatingClick(e, 0)}
              className="py-1 px-2 text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
              title="Again (Reset interval)"
            >
              Again
            </button>
            <button
              onClick={(e) => handleRatingClick(e, 3)}
              className="py-1 px-2 text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 rounded transition-colors"
              title="Hard"
            >
              Hard
            </button>
            <button
              onClick={(e) => handleRatingClick(e, 4)}
              className="py-1 px-2 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
              title="Good"
            >
              Good
            </button>
            <button
              onClick={(e) => handleRatingClick(e, 5)}
              className="py-1 px-2 text-xs font-semibold text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors"
              title="Easy"
            >
              Easy
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FlashcardWidget;
