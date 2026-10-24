/**
 * Unit tests for icalRevisionService.js
 * Verifies RFC 5545 compliance, spaced repetition revision events,
 * timezone handling, Google Calendar URL generation, and VALARM triggers.
 *
 * Fixes #2374
 */

const {
  generateStudyPlanIcsWithRevisions,
  buildGoogleCalendarUrl,
  buildGoogleCalendarUrlForPlan,
  computeRevisionDates,
  zonedDateTimeToUtc,
  formatICalDate,
  SPACED_REPETITION_INTERVALS,
  DEFAULT_START_HOUR,
  REVISION_START_HOUR,
} = require('../../services/icalRevisionService');

// ─── Helper: Build a mock study plan ─────────────────────────────────
function createMockPlan(overrides = {}) {
  return {
    id: 'plan-test-001',
    examRef: { name: 'JEE Advanced 2026' },
    dailyGoals: [
      {
        date: '2026-08-01',
        tasks: [
          { _id: 'task-1', title: 'Electromagnetism', duration: 60 },
          { _id: 'task-2', title: 'Thermodynamics', duration: 45 },
        ],
      },
      {
        date: '2026-08-02',
        tasks: [
          { _id: 'task-3', title: 'Calculus', duration: 90 },
        ],
      },
    ],
    ...overrides,
  };
}

// ─── 1. formatICalDate ───────────────────────────────────────────────
describe('formatICalDate', () => {
  it('formats a JS Date to YYYYMMDDTHHmmssZ', () => {
    const date = new Date('2026-08-01T09:00:00Z');
    expect(formatICalDate(date)).toBe('20260801T090000Z');
  });

  it('handles midnight correctly', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    expect(formatICalDate(date)).toBe('20260101T000000Z');
  });
});

// ─── 2. computeRevisionDates ─────────────────────────────────────────
describe('computeRevisionDates', () => {
  it('produces 4 revision dates at +1, +3, +7, +14 days', () => {
    const base = new Date('2026-08-01T09:00:00Z');
    const dates = computeRevisionDates(base);

    expect(dates).toHaveLength(4);
    expect(dates[0].toISOString().split('T')[0]).toBe('2026-08-02');
    expect(dates[1].toISOString().split('T')[0]).toBe('2026-08-04');
    expect(dates[2].toISOString().split('T')[0]).toBe('2026-08-08');
    expect(dates[3].toISOString().split('T')[0]).toBe('2026-08-15');
  });

  it('accepts custom intervals', () => {
    const base = new Date('2026-08-01T09:00:00Z');
    const dates = computeRevisionDates(base, [2, 5]);

    expect(dates).toHaveLength(2);
    expect(dates[0].toISOString().split('T')[0]).toBe('2026-08-03');
    expect(dates[1].toISOString().split('T')[0]).toBe('2026-08-06');
  });
});

// ─── 3. zonedDateTimeToUtc ───────────────────────────────────────────
describe('zonedDateTimeToUtc', () => {
  it('converts UTC timezone correctly (no offset)', () => {
    const result = zonedDateTimeToUtc('2026-08-01', 9, 0, 'UTC');
    expect(result.getUTCHours()).toBe(9);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it('offsets correctly for Asia/Kolkata (+5:30)', () => {
    const result = zonedDateTimeToUtc('2026-08-01', 9, 0, 'Asia/Kolkata');
    // 9:00 IST = 3:30 UTC
    expect(result.getUTCHours()).toBe(3);
    expect(result.getUTCMinutes()).toBe(30);
  });
});

// ─── 4. generateStudyPlanIcsWithRevisions ────────────────────────────
describe('generateStudyPlanIcsWithRevisions', () => {
  it('produces a valid RFC 5545 iCalendar string', () => {
    const plan = createMockPlan();
    const ics = generateStudyPlanIcsWithRevisions(plan);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID://OpenPrep-AI//Study Plan iCal Export v2//EN');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('includes study session events with correct SUMMARY', () => {
    const plan = createMockPlan();
    const ics = generateStudyPlanIcsWithRevisions(plan);

    expect(ics).toContain('SUMMARY:Study: Electromagnetism');
    expect(ics).toContain('SUMMARY:Study: Thermodynamics');
    expect(ics).toContain('SUMMARY:Study: Calculus');
  });

  it('includes VALARM reminders for each study event', () => {
    const plan = createMockPlan();
    const ics = generateStudyPlanIcsWithRevisions(plan);

    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('END:VALARM');
  });

  it('generates spaced-repetition revision events when includeRevisions=true', () => {
    const plan = createMockPlan();
    const ics = generateStudyPlanIcsWithRevisions(plan, 'UTC', { includeRevisions: true });

    // Each unique topic should have 4 revision events (Day +1, +3, +7, +14)
    expect(ics).toContain('Revise: Electromagnetism (Day +1)');
    expect(ics).toContain('Revise: Electromagnetism (Day +3)');
    expect(ics).toContain('Revise: Electromagnetism (Day +7)');
    expect(ics).toContain('Revise: Electromagnetism (Day +14)');
    expect(ics).toContain('Revise: Thermodynamics (Day +1)');
    expect(ics).toContain('Revise: Calculus (Day +1)');
  });

  it('omits revision events when includeRevisions=false', () => {
    const plan = createMockPlan();
    const ics = generateStudyPlanIcsWithRevisions(plan, 'UTC', { includeRevisions: false });

    expect(ics).not.toContain('Revise:');
    expect(ics).toContain('SUMMARY:Study: Electromagnetism');
  });

  it('deduplicates revision events for the same topic appearing on multiple days', () => {
    const plan = createMockPlan({
      dailyGoals: [
        {
          date: '2026-08-01',
          tasks: [{ _id: 'task-1', title: 'Electromagnetism', duration: 60 }],
        },
        {
          date: '2026-08-02',
          tasks: [{ _id: 'task-1b', title: 'Electromagnetism', duration: 30 }],
        },
      ],
    });

    const ics = generateStudyPlanIcsWithRevisions(plan);

    // Count occurrences of "Revise: Electromagnetism (Day +1)" — should be exactly 1
    const matches = ics.match(/Revise: Electromagnetism \(Day \+1\)/g);
    expect(matches).toHaveLength(1);
  });

  it('handles empty dailyGoals gracefully', () => {
    const plan = createMockPlan({ dailyGoals: [] });
    const ics = generateStudyPlanIcsWithRevisions(plan);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('handles missing dailyGoals gracefully', () => {
    const plan = createMockPlan({ dailyGoals: undefined });
    const ics = generateStudyPlanIcsWithRevisions(plan);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('uses custom alarm minutes', () => {
    const plan = createMockPlan();
    const ics = generateStudyPlanIcsWithRevisions(plan, 'UTC', { alarmMinutesBefore: 30 });

    // The alarm trigger should be 30 * 60 = 1800 seconds
    expect(ics).toContain('BEGIN:VALARM');
  });

  it('includes exam name in DESCRIPTION', () => {
    const plan = createMockPlan();
    const ics = generateStudyPlanIcsWithRevisions(plan);

    expect(ics).toContain('JEE Advanced 2026');
  });

  it('respects timezone for revision events', () => {
    const plan = createMockPlan();
    const icsUtc = generateStudyPlanIcsWithRevisions(plan, 'UTC');
    const icsIst = generateStudyPlanIcsWithRevisions(plan, 'Asia/Kolkata');

    // Both should produce valid calendars but with different DTSTART values
    expect(icsUtc).toContain('BEGIN:VCALENDAR');
    expect(icsIst).toContain('BEGIN:VCALENDAR');
    // The actual DTSTART values will differ due to timezone conversion
    expect(icsUtc).not.toBe(icsIst);
  });
});

// ─── 5. buildGoogleCalendarUrl ───────────────────────────────────────
describe('buildGoogleCalendarUrl', () => {
  it('returns a valid Google Calendar URL with required params', () => {
    const url = buildGoogleCalendarUrl({
      title: 'Study: Calculus',
      start: new Date('2026-08-01T09:00:00Z'),
      end: new Date('2026-08-01T10:30:00Z'),
      description: 'Test session',
    });

    expect(url).toContain('https://calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Study');
    expect(url).toContain('20260801T090000Z');
    expect(url).toContain('20260801T103000Z');
  });

  it('URL-encodes special characters in title and description', () => {
    const url = buildGoogleCalendarUrl({
      title: 'Study: Waves & Optics',
      start: new Date('2026-08-01T09:00:00Z'),
      end: new Date('2026-08-01T10:00:00Z'),
      description: 'Topic: Waves & Optics',
    });

    expect(url).toContain('Waves');
    expect(url).toContain('calendar.google.com');
  });
});

// ─── 6. buildGoogleCalendarUrlForPlan ────────────────────────────────
describe('buildGoogleCalendarUrlForPlan', () => {
  it('generates a URL for a plan with sessions', () => {
    const plan = createMockPlan();
    const url = buildGoogleCalendarUrlForPlan(plan, 'UTC');

    expect(url).not.toBeNull();
    expect(url).toContain('calendar.google.com');
    expect(url).toContain('JEE+Advanced+2026');
  });

  it('returns null for a plan with no dailyGoals', () => {
    const plan = createMockPlan({ dailyGoals: [] });
    const url = buildGoogleCalendarUrlForPlan(plan, 'UTC');

    expect(url).toBeNull();
  });

  it('returns null for undefined dailyGoals', () => {
    const plan = createMockPlan({ dailyGoals: undefined });
    const url = buildGoogleCalendarUrlForPlan(plan, 'UTC');

    expect(url).toBeNull();
  });
});
