import React from 'react';
import PropTypes from 'prop-types';
import { X, BookOpen, Brain, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react';
import { getMasteryColor } from './SyllabusSunburstChart';

export const TopicMasteryDrawer = ({ isOpen, onClose, topicData }) => {
  if (!isOpen || !topicData) return null;

  const mastery = topicData.mastery || 0;
  const accuracy = topicData.accuracy || Math.min(95, Math.max(30, Math.round(mastery * 0.95)));
  const questionsPracticed = topicData.questionsPracticed || Math.round(mastery * 0.6) + 12;
  const pyqFrequency = topicData.pyqFrequency || 'Appeared in 7 of the last 10 exams';
  const masteryColor = getMasteryColor(mastery);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      aria-labelledby="slide-over-title"
      role="dialog"
      aria-modal="true"
      data-testid="topic-mastery-drawer"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-neutral-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-6 border-b border-neutral-100 dark:border-slate-800 flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                {topicData.tierName || 'Topic Mastery'}
              </span>
              <h2 id="slide-over-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {topicData.name}
              </h2>
              {topicData.parentName && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {topicData.parentName}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-slate-800 transition"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Mastery & PYQ Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-slate-800 bg-neutral-50 dark:bg-slate-800/40">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Current Mastery</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-gray-900 dark:text-gray-100" style={{ color: masteryColor }}>
                    {mastery}%
                  </span>
                  <span className="text-xs font-semibold text-neutral-400">
                    {mastery >= 75 ? 'Mastered' : mastery >= 50 ? 'Moderate' : 'Priority Gap'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-neutral-200 dark:border-slate-800 bg-neutral-50 dark:bg-slate-800/40">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Exam Weightage</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-primary-600 dark:text-primary-400">
                    {topicData.weightage}%
                  </span>
                  <span className="text-xs text-neutral-400">of syllabus</span>
                </div>
              </div>
            </div>

            {/* Historical Exam Frequency */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/50 flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">Historical PYQ Pattern</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  {pyqFrequency}
                </p>
              </div>
            </div>

            {/* Practice & Accuracy Metrics */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Practice Performance</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-300">
                  <span>Accuracy Rate</span>
                  <span className="font-semibold">{accuracy}%</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${accuracy}%`, backgroundColor: masteryColor }}
                  />
                </div>

                <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 pt-1">
                  <span>Questions Practiced</span>
                  <span className="font-mono font-medium text-gray-800 dark:text-gray-200">{questionsPracticed} attempted</span>
                </div>
              </div>
            </div>

            {/* Recommended Learning Path */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Recommended Actions</h4>
              <div className="space-y-2">
                <div className="p-3 rounded-lg border border-neutral-200 dark:border-slate-800 hover:border-primary-400 dark:hover:border-primary-600 transition flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Brain className="w-4 h-4 text-primary-500" />
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">Review 12 Due Flashcards</p>
                      <p className="text-[11px] text-neutral-400">Reinforce definitions & formulas</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400">Start</span>
                </div>

                <div className="p-3 rounded-lg border border-neutral-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 transition flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-4 h-4 text-emerald-500" />
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">Take 10-Question PYQ Drill</p>
                      <p className="text-[11px] text-neutral-400">Historical questions from 2018-2024</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Practice</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-neutral-100 dark:border-slate-800 bg-neutral-50/50 dark:bg-slate-800/50 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-slate-700 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-slate-800 transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-xs font-semibold text-white transition shadow-sm"
            >
              Launch Targeted Drill
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

TopicMasteryDrawer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  topicData: PropTypes.object,
};

export default TopicMasteryDrawer;
