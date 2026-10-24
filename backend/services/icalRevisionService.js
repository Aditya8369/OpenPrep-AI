/**
 * iCal Revision Service
 *
 * Generates RFC 5545 compliant iCalendar (.ics) payloads that include:
 *   - Study session VEVENT blocks with VALARM reminders
 *   - Recurring spaced-repetition revision VEVENTs using RRULE
 *   - Google Calendar pre-filled URL generation
 *
 * Fixes #2374
 */

const icalGenerator = require('ical-generator');
const ical =
  typeof icalGenerator === 'function'
    ? icalGenerator
    : icalGenerator.ical || icalGenerator.default || icalGenerator;

const DEFAULT_START_HOUR = 9;
const REVISION_START_HOUR = 18; // Revision blocks default to 6 PM

/**
 * Spaced-repetition interval presets (in days).
 * Based on a simplified SM-2 schedule: review after 1, 3, 7, and 14 days.
 */
const SPACED_REPETITION_INTERVALS = [1, 3, 7, 14];

/**
 * Converts a local date/time in the user's IANA timezone into a UTC Date.
 */
function zonedDateTimeToUtc(dateString, hour, minute, timeZone) {
  const [year, month, day] = dateString.split('-').map(Number);

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(utcGuess);

  const values = {};
  parts.forEach(({ type, value }) => {
    values[type] = value;
  });

  const timezoneEquivalentUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  const offset = timezoneEquivalentUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset);
}

/**
 * Formats a JS Date to the iCal DTSTART-compatible UTC string: YYYYMMDDTHHmmssZ
 */
function formatICalDate(d) {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Computes spaced-repetition revision dates from a base study date.
 *
 * @param {Date} baseDate - The original study session date
 * @param {number[]} intervals - Array of day intervals for revision
 * @returns {Date[]} Array of revision dates
 */
function computeRevisionDates(baseDate, intervals = SPACED_REPETITION_INTERVALS) {
  return intervals.map((dayOffset) => {
    const revDate = new Date(baseDate.getTime());
    revDate.setDate(revDate.getDate() + dayOffset);
    return revDate;
  });
}

/**
 * Generates an RFC 5545 compliant .ics calendar with study sessions
 * AND recurring spaced-repetition revision reminder events.
 *
 * @param {Object} plan - The study plan object (with dailyGoals, examRef)
 * @param {string} timeZone - IANA timezone string (e.g. 'Asia/Kolkata')
 * @param {Object} options - Export options
 * @param {boolean} options.includeRevisions - Whether to add revision events (default: true)
 * @param {number} options.revisionDurationMinutes - Duration of each revision block (default: 30)
 * @param {number} options.alarmMinutesBefore - VALARM trigger in minutes (default: 15)
 * @returns {string} RFC 5545 iCalendar string
 */
function generateStudyPlanIcsWithRevisions(plan, timeZone = 'UTC', options = {}) {
  const {
    includeRevisions = true,
    revisionDurationMinutes = 30,
    alarmMinutesBefore = 15,
  } = options;

  const examName = plan.examRef?.name || 'Exam Study Plan';

  const calendar = ical({
    name: `${examName} - Study Plan`,
    prodId: '//OpenPrep-AI//Study Plan iCal Export v2//EN',
  });

  calendar.method('PUBLISH');

  if (!Array.isArray(plan.dailyGoals)) {
    return calendar.toString();
  }

  // Track unique topics for revision deduplication
  const topicRevisionMap = new Map();

  for (const day of plan.dailyGoals) {
    if (!day.date || !Array.isArray(day.tasks)) continue;

    let currentMinutes = DEFAULT_START_HOUR * 60;

    for (const task of day.tasks) {
      const durationMinutes = Math.max(1, Number(task.duration) || 60);
      const startHour = Math.floor(currentMinutes / 60);
      const startMinute = currentMinutes % 60;

      const start = zonedDateTimeToUtc(day.date, startHour, startMinute, timeZone);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      const eventId = `${task._id || task.id || `${plan.id}-${day.date}-${currentMinutes}`}@openprep.ai`;

      // Study session VEVENT
      const description =
        `Study Plan: ${examName}\n` +
        `Topic: ${task.title}\n` +
        `Duration: ${durationMinutes} minutes\n` +
        `Open in OpenPrep: ${process.env.FRONTEND_URL || 'https://openprep.ai'}/study-plans/${plan.id || plan._id}`;

      calendar.createEvent({
        id: eventId,
        start,
        end,
        summary: `Study: ${task.title}`,
        description,
        alarms: [
          {
            type: 'display',
            trigger: alarmMinutesBefore * 60,
            description: `Reminder: ${task.title} starts in ${alarmMinutesBefore} minutes`,
          },
        ],
      });

      currentMinutes += durationMinutes;

      // Collect revision entries (deduplicate by topic title)
      if (includeRevisions) {
        const topicKey = (task.title || '').trim().toLowerCase();
        if (topicKey && !topicRevisionMap.has(topicKey)) {
          topicRevisionMap.set(topicKey, {
            title: task.title,
            originalDate: day.date,
            start,
            taskId: task._id || task.id || `${plan.id}-rev-${day.date}`,
          });
        }
      }
    }
  }

  // Generate revision VEVENTs with spaced repetition intervals
  if (includeRevisions) {
    for (const [, entry] of topicRevisionMap) {
      const revisionDates = computeRevisionDates(entry.start);

      for (let i = 0; i < revisionDates.length; i++) {
        const revStartLocal = zonedDateTimeToUtc(
          revisionDates[i].toISOString().split('T')[0],
          REVISION_START_HOUR,
          0,
          timeZone
        );
        const revEnd = new Date(
          revStartLocal.getTime() + revisionDurationMinutes * 60 * 1000
        );

        const intervalLabel = SPACED_REPETITION_INTERVALS[i];
        const revEventId = `${entry.taskId}-rev-d${intervalLabel}@openprep.ai`;

        calendar.createEvent({
          id: revEventId,
          start: revStartLocal,
          end: revEnd,
          summary: `Revise: ${entry.title} (Day +${intervalLabel})`,
          description:
            `Spaced Repetition Revision\n` +
            `Topic: ${entry.title}\n` +
            `Original study date: ${entry.originalDate}\n` +
            `Revision interval: +${intervalLabel} day${intervalLabel > 1 ? 's' : ''}\n` +
            `Duration: ${revisionDurationMinutes} minutes\n` +
            `Open in OpenPrep: ${process.env.FRONTEND_URL || 'https://openprep.ai'}/study-plans/${plan.id || plan._id}`,
          alarms: [
            {
              type: 'display',
              trigger: alarmMinutesBefore * 60,
              description: `Revision reminder: ${entry.title} — review in ${alarmMinutesBefore} minutes`,
            },
          ],
        });
      }
    }
  }

  return calendar.toString();
}

/**
 * Generates a Google Calendar "Add Event" URL for a single study session.
 *
 * @param {Object} event - Event details
 * @param {string} event.title - Event title
 * @param {Date|string} event.start - Start date/time
 * @param {Date|string} event.end - End date/time
 * @param {string} [event.description] - Event description
 * @param {string} [event.location] - Event location
 * @returns {string} Google Calendar URL
 */
function buildGoogleCalendarUrl(event) {
  const base = 'https://calendar.google.com/calendar/render';

  const startStr = formatICalDate(new Date(event.start));
  const endStr = formatICalDate(new Date(event.end));

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'OpenPrep Study Session',
    dates: `${startStr}/${endStr}`,
    details: event.description || 'Study session from OpenPrep AI',
    location: event.location || '',
    sf: 'true',
  });

  // Add recurrence if revision intervals are provided
  if (event.recurrence) {
    params.set('recur', event.recurrence);
  }

  return `${base}?${params.toString()}`;
}

/**
 * Generates a Google Calendar URL for the first upcoming study session in a plan.
 *
 * @param {Object} plan - The study plan object
 * @param {string} timeZone - IANA timezone
 * @returns {string|null} Google Calendar URL or null if no sessions found
 */
function buildGoogleCalendarUrlForPlan(plan, timeZone = 'UTC') {
  const examName = plan.examRef?.name || 'Exam Study Plan';

  if (!Array.isArray(plan.dailyGoals) || plan.dailyGoals.length === 0) {
    return null;
  }

  // Find the first upcoming session
  const now = new Date();
  for (const day of plan.dailyGoals) {
    if (!day.date || !Array.isArray(day.tasks)) continue;

    let currentMinutes = DEFAULT_START_HOUR * 60;
    for (const task of day.tasks) {
      const durationMinutes = Math.max(1, Number(task.duration) || 60);
      const startHour = Math.floor(currentMinutes / 60);
      const startMinute = currentMinutes % 60;

      const start = zonedDateTimeToUtc(day.date, startHour, startMinute, timeZone);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      if (start >= now || end >= now) {
        return buildGoogleCalendarUrl({
          title: `Study: ${task.title} - ${examName}`,
          start,
          end,
          description:
            `Study Plan: ${examName}\n` +
            `Topic: ${task.title}\n` +
            `Duration: ${durationMinutes} minutes\n` +
            `Powered by OpenPrep AI`,
        });
      }

      currentMinutes += durationMinutes;
    }
  }

  // Fallback: use the very first session
  const firstDay = plan.dailyGoals[0];
  if (firstDay?.date && firstDay.tasks?.[0]) {
    const task = firstDay.tasks[0];
    const durationMinutes = Math.max(1, Number(task.duration) || 60);
    const start = zonedDateTimeToUtc(firstDay.date, DEFAULT_START_HOUR, 0, timeZone);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    return buildGoogleCalendarUrl({
      title: `Study: ${task.title} - ${examName}`,
      start,
      end,
      description:
        `Study Plan: ${examName}\nTopic: ${task.title}\nDuration: ${durationMinutes} minutes`,
    });
  }

  return null;
}

module.exports = {
  generateStudyPlanIcsWithRevisions,
  buildGoogleCalendarUrl,
  buildGoogleCalendarUrlForPlan,
  computeRevisionDates,
  zonedDateTimeToUtc,
  formatICalDate,
  SPACED_REPETITION_INTERVALS,
  DEFAULT_START_HOUR,
  REVISION_START_HOUR,
};
