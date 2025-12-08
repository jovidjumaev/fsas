/**
 * Centralized Timezone Utility Library
 *
 * This library provides timezone-aware date/time utilities that automatically
 * handle daylight saving time transitions and timezone changes.
 *
 * Key Features:
 * - Automatic DST handling
 * - User's local timezone detection
 * - Consistent UTC storage
 * - Locale-aware display formatting
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

/**
 * Get the user's detected timezone
 * Falls back to America/New_York if detection fails
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  } catch (error) {
    console.warn('Failed to detect timezone, using America/New_York as default');
    return 'America/New_York';
  }
}

/**
 * Get current date/time in user's timezone
 */
export function now(timezone?: string): dayjs.Dayjs {
  const tz = timezone || getUserTimezone();
  return dayjs().tz(tz);
}

/**
 * Convert any date input to dayjs object in user's timezone
 * Handles: Date objects, ISO strings, timestamps, dayjs objects
 */
export function parseDate(date: string | Date | number | dayjs.Dayjs, timezone?: string): dayjs.Dayjs {
  const tz = timezone || getUserTimezone();

  if (!date) {
    return now(tz);
  }

  // If it's already a dayjs object, convert to the target timezone
  if (dayjs.isDayjs(date)) {
    return date.tz(tz);
  }

  // Parse the date and convert to timezone
  return dayjs(date).tz(tz);
}

/**
 * Format date for storage (always UTC ISO string)
 * Use this when saving to database
 */
export function toUTC(date: string | Date | number | dayjs.Dayjs): string {
  return dayjs(date).utc().toISOString();
}

/**
 * Format date for display in user's timezone
 */
export function formatDateTime(
  date: string | Date | number | dayjs.Dayjs,
  format: string = 'YYYY-MM-DD HH:mm:ss',
  timezone?: string
): string {
  return parseDate(date, timezone).format(format);
}

/**
 * Format date only (no time)
 */
export function formatDate(
  date: string | Date | number | dayjs.Dayjs,
  format: string = 'YYYY-MM-DD',
  timezone?: string
): string {
  return parseDate(date, timezone).format(format);
}

/**
 * Format time only (no date)
 */
export function formatTime(
  date: string | Date | number | dayjs.Dayjs,
  format: string = 'h:mm A',
  timezone?: string
): string {
  return parseDate(date, timezone).format(format);
}

/**
 * Format time for display (12-hour format with AM/PM)
 */
export function formatTime12Hour(
  date: string | Date | number | dayjs.Dayjs,
  timezone?: string
): string {
  return formatTime(date, 'h:mm A', timezone);
}

/**
 * Format time for display (24-hour format)
 */
export function formatTime24Hour(
  date: string | Date | number | dayjs.Dayjs,
  timezone?: string
): string {
  return formatTime(date, 'HH:mm', timezone);
}

/**
 * Get a human-readable relative time (e.g., "2 hours ago", "in 5 minutes")
 */
export function fromNow(date: string | Date | number | dayjs.Dayjs, timezone?: string): string {
  return parseDate(date, timezone).fromNow();
}

/**
 * Get relative time to another date
 */
export function toNow(date: string | Date | number | dayjs.Dayjs, timezone?: string): string {
  return parseDate(date, timezone).toNow();
}

/**
 * Add time to a date
 */
export function addTime(
  date: string | Date | number | dayjs.Dayjs,
  amount: number,
  unit: dayjs.ManipulateType,
  timezone?: string
): dayjs.Dayjs {
  return parseDate(date, timezone).add(amount, unit);
}

/**
 * Subtract time from a date
 */
export function subtractTime(
  date: string | Date | number | dayjs.Dayjs,
  amount: number,
  unit: dayjs.ManipulateType,
  timezone?: string
): dayjs.Dayjs {
  return parseDate(date, timezone).subtract(amount, unit);
}

/**
 * Get difference between two dates in specified unit
 */
export function diff(
  date1: string | Date | number | dayjs.Dayjs,
  date2: string | Date | number | dayjs.Dayjs,
  unit: dayjs.QUnitType | dayjs.OpUnitType = 'millisecond',
  precise: boolean = false,
  timezone?: string
): number {
  const d1 = parseDate(date1, timezone);
  const d2 = parseDate(date2, timezone);
  return d1.diff(d2, unit, precise);
}

/**
 * Check if date is before another date
 */
export function isBefore(
  date1: string | Date | number | dayjs.Dayjs,
  date2: string | Date | number | dayjs.Dayjs,
  timezone?: string
): boolean {
  const d1 = parseDate(date1, timezone);
  const d2 = parseDate(date2, timezone);
  return d1.isBefore(d2);
}

/**
 * Check if date is after another date
 */
export function isAfter(
  date1: string | Date | number | dayjs.Dayjs,
  date2: string | Date | number | dayjs.Dayjs,
  timezone?: string
): boolean {
  const d1 = parseDate(date1, timezone);
  const d2 = parseDate(date2, timezone);
  return d1.isAfter(d2);
}

/**
 * Check if date is same or before another date
 */
export function isSameOrBefore(
  date1: string | Date | number | dayjs.Dayjs,
  date2: string | Date | number | dayjs.Dayjs,
  timezone?: string
): boolean {
  const d1 = parseDate(date1, timezone);
  const d2 = parseDate(date2, timezone);
  return d1.isBefore(d2) || d1.isSame(d2);
}

/**
 * Check if date is same or after another date
 */
export function isSameOrAfter(
  date1: string | Date | number | dayjs.Dayjs,
  date2: string | Date | number | dayjs.Dayjs,
  timezone?: string
): boolean {
  const d1 = parseDate(date1, timezone);
  const d2 = parseDate(date2, timezone);
  return d1.isAfter(d2) || d1.isSame(d2);
}

/**
 * Get start of day in user's timezone
 */
export function startOfDay(date: string | Date | number | dayjs.Dayjs, timezone?: string): dayjs.Dayjs {
  return parseDate(date, timezone).startOf('day');
}

/**
 * Get end of day in user's timezone
 */
export function endOfDay(date: string | Date | number | dayjs.Dayjs, timezone?: string): dayjs.Dayjs {
  return parseDate(date, timezone).endOf('day');
}

/**
 * Get day of week (0 = Sunday, 1 = Monday, etc.)
 */
export function getDayOfWeek(date: string | Date | number | dayjs.Dayjs, timezone?: string): number {
  return parseDate(date, timezone).day();
}

/**
 * Get today's date string (YYYY-MM-DD) in user's timezone
 */
export function getTodayString(timezone?: string): string {
  return formatDate(now(timezone), 'YYYY-MM-DD', timezone);
}

/**
 * Parse time string (HH:MM or HH:MM:SS) and combine with date
 */
export function parseTimeString(
  timeString: string,
  date: string | Date | number | dayjs.Dayjs = now(),
  timezone?: string
): dayjs.Dayjs {
  const [hours, minutes, seconds = '0'] = timeString.split(':');
  const baseDate = parseDate(date, timezone);

  return baseDate
    .hour(parseInt(hours, 10))
    .minute(parseInt(minutes, 10))
    .second(parseInt(seconds, 10))
    .millisecond(0);
}

/**
 * Create a date-time from separate date and time strings
 * Useful for database date + time columns
 */
export function combineDateAndTime(
  dateString: string,
  timeString: string,
  timezone?: string
): dayjs.Dayjs {
  return parseTimeString(timeString, dateString, timezone);
}

/**
 * Format for locale-specific display
 */
export function formatLocale(
  date: string | Date | number | dayjs.Dayjs,
  options: Intl.DateTimeFormatOptions = {},
  timezone?: string
): string {
  const tz = timezone || getUserTimezone();
  const parsed = parseDate(date, timezone);

  return parsed.toDate().toLocaleString('en-US', {
    timeZone: tz,
    ...options
  });
}

/**
 * Get greeting based on time of day
 */
export function getTimeOfDayGreeting(timezone?: string): string {
  const hour = now(timezone).hour();

  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

/**
 * Calculate remaining time and format for display
 */
export function getRemainingTime(
  endDate: string | Date | number | dayjs.Dayjs,
  timezone?: string
): { milliseconds: number; formatted: string; isExpired: boolean } {
  const end = parseDate(endDate, timezone);
  const current = now(timezone);
  const milliseconds = Math.max(0, end.diff(current));

  return {
    milliseconds,
    formatted: formatDuration(milliseconds),
    isExpired: milliseconds === 0
  };
}

/**
 * Session-specific: Calculate session end time (1 hour from activation)
 */
export function calculateSessionEndTime(
  activationTime: string | Date | number | dayjs.Dayjs,
  durationHours: number = 1,
  timezone?: string
): dayjs.Dayjs {
  return addTime(activationTime, durationHours, 'hour', timezone);
}

/**
 * Session-specific: Get session time remaining
 */
export function getSessionTimeRemaining(
  activationTime: string | Date | number | dayjs.Dayjs,
  durationHours: number = 1,
  timezone?: string
): { seconds: number; minutes: number; formatted: string; isExpired: boolean } {
  const endTime = calculateSessionEndTime(activationTime, durationHours, timezone);
  const remaining = getRemainingTime(endTime, timezone);
  const seconds = Math.floor(remaining.milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);

  return {
    seconds,
    minutes,
    formatted: remaining.formatted,
    isExpired: remaining.isExpired
  };
}

/**
 * Export dayjs for advanced usage
 */
export { dayjs };

/**
 * Type exports for TypeScript users
 */
export type { Dayjs } from 'dayjs';
