import React, { useState, useCallback } from 'react';
import { Calendar, Download, ExternalLink, X, Loader2, Check, RefreshCw } from 'lucide-react';
import API from '../../services/api';

/**
 * ExportCalendarModal
 *
 * Provides a modal UI for exporting study plans to:
 *   1. Downloadable .ics file (with optional spaced-repetition revision events)
 *   2. "Add to Google Calendar" dynamic URL
 *
 * Fixes #2374
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {Function} props.onClose - Handler to close the modal
 * @param {string} props.planId - The study plan ID to export
 * @param {string} [props.planName] - Display name for the study plan
 */
export default function ExportCalendarModal({ isOpen, onClose, planId, planName }) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [includeRevisions, setIncludeRevisions] = useState(true);
  const [googleCalUrl, setGoogleCalUrl] = useState(null);
  const [loadingGcal, setLoadingGcal] = useState(false);
  const [error, setError] = useState('');

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  /**
   * Downloads the .ics file from the backend export endpoint
   */
  const handleDownloadIcs = useCallback(async () => {
    if (!planId) return;
    setDownloading(true);
    setError('');
    setDownloaded(false);

    try {
      const endpoint = includeRevisions
        ? `/study-plans/${planId}/export-ics?revisions=true`
        : `/study-plans/${planId}/export-ics`;

      const response = await API.get(endpoint, {
        responseType: 'blob',
        headers: {
          'X-Timezone': userTimezone,
        },
      });

      // Create downloadable blob link
      const blob = new Blob([response.data], { type: 'text/calendar;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `openprep-study-plan-${planId}.ics`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } catch (err) {
      console.error('ICS download failed:', err);
      setError('Failed to download calendar file. Please try again.');
    } finally {
      setDownloading(false);
    }
  }, [planId, includeRevisions, userTimezone]);

  /**
   * Fetches the Google Calendar URL from the backend
   */
  const handleAddToGoogleCalendar = useCallback(async () => {
    if (!planId) return;
    setLoadingGcal(true);
    setError('');

    try {
      const response = await API.get(`/study-plans/${planId}/google-calendar-url`, {
        headers: {
          'X-Timezone': userTimezone,
        },
      });

      const url = response.data?.data?.url;
      if (url) {
        setGoogleCalUrl(url);
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setError('Could not generate Google Calendar link.');
      }
    } catch (err) {
      console.error('Google Calendar URL generation failed:', err);
      // Fallback: construct a basic URL client-side
      const fallbackUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        planName || 'OpenPrep Study Session'
      )}&details=${encodeURIComponent('Study session from OpenPrep AI')}&sf=true`;
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setLoadingGcal(false);
    }
  }, [planId, planName, userTimezone]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-inter text-[#1F150C] dark:text-[#E1DCC9]">
      <div className="bg-[#FFFBE9] dark:bg-[#16120E] border border-[#CEAB93]/60 dark:border-[#412D15] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20">
              <Calendar className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Export to Calendar</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Sync your study plan with your favorite calendar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 transition-colors"
            aria-label="Close export modal"
          >
            <X className="w-4 h-4 text-stone-500" />
          </button>
        </div>

        {/* ─── Plan name ─── */}
        {planName && (
          <div className="mb-5 px-3 py-2 rounded-xl bg-stone-100/60 dark:bg-stone-900/40 border border-stone-200/50 dark:border-stone-800/50">
            <p className="text-xs text-stone-500 dark:text-stone-400">Study Plan</p>
            <p className="text-sm font-semibold truncate">{planName}</p>
          </div>
        )}

        {/* ─── Revision toggle ─── */}
        <div className="mb-5 flex items-center gap-3 px-3 py-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
          <label className="flex items-center gap-2 cursor-pointer flex-1">
            <input
              type="checkbox"
              checked={includeRevisions}
              onChange={(e) => setIncludeRevisions(e.target.checked)}
              className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <span className="text-sm font-medium">Include Revision Reminders</span>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Adds spaced-repetition review events at +1, +3, +7, and +14 days
              </p>
            </div>
          </label>
          <RefreshCw className="w-4 h-4 text-amber-500 flex-shrink-0" />
        </div>

        {/* ─── Error message ─── */}
        {error && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* ─── Action buttons ─── */}
        <div className="space-y-3">
          {/* Download .ics */}
          <button
            onClick={handleDownloadIcs}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm
              bg-indigo-600 hover:bg-indigo-700 text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : downloaded ? (
              <>
                <Check className="w-4 h-4" />
                Downloaded!
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download .ics File
              </>
            )}
          </button>

          {/* Add to Google Calendar */}
          <button
            onClick={handleAddToGoogleCalendar}
            disabled={loadingGcal}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm
              bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800
              border border-stone-200 dark:border-stone-700
              text-stone-700 dark:text-stone-200
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200"
          >
            {loadingGcal ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Opening...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Add to Google Calendar
              </>
            )}
          </button>
        </div>

        {/* ─── Timezone info ─── */}
        <div className="mt-5 text-center">
          <p className="text-[10px] text-stone-400 dark:text-stone-500">
            Events will be exported in your timezone: <span className="font-mono font-medium">{userTimezone}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
