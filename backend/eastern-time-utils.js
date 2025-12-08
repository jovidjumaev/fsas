const { createLogger } = require('./lib/logger');
const logger = createLogger('Backend');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Eastern Time zone
const EASTERN_TZ = 'America/New_York';

// =====================================================
// EASTERN TIME UTILITY FUNCTIONS
// =====================================================

/**
 * Convert a UTC date/time to Eastern Time
 * @param {Date} utcDate - The UTC date to convert
 * @returns {Date} - The date in Eastern Time
 */
function toEasternTime(utcDate) {
  return dayjs(utcDate).tz(EASTERN_TZ).toDate();
}

/**
 * Create a date in Eastern Time from date and time strings
 * Automatically handles DST transitions (EDT vs EST)
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} time - Time string (HH:MM:SS or HH:MM)
 * @returns {Date} - The date in Eastern Time
 */
function createEasternDate(date, time) {
  // Ensure proper time format
  const timeString = time.includes(':') ? time : `${time}:00`;

  // Parse the date and time components
  const [year, month, day] = date.split('-');
  const [hour, minute, second = '00'] = timeString.split(':');

  // Create the date/time string
  const dateTimeString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;

  // Parse in Eastern Time zone (automatically handles DST)
  const easternDate = dayjs.tz(dateTimeString, EASTERN_TZ);

  // Check if the date is valid
  if (!easternDate.isValid()) {
    logger.error(`❌ Invalid date created: ${dateTimeString}`);
    return new Date(); // Return current time as fallback
  }

  return easternDate.toDate();
}

/**
 * Get current time in Eastern Time
 * @returns {Date} - Current time in Eastern Time (as a Date object representing that moment in time)
 */
function getCurrentEasternTime() {
  // Return current time - Date objects represent a moment in time (UTC internally)
  return new Date();
}

/**
 * Check if current Eastern Time is within a time range
 * @param {string} startTime - Start time (HH:MM:SS)
 * @param {string} endTime - End time (HH:MM:SS)
 * @param {string} date - Date (YYYY-MM-DD), defaults to today
 * @returns {boolean} - True if current time is within range
 */
function isWithinEasternTimeRange(startTime, endTime, date = null) {
  const now = getCurrentEasternTime();
  const nowEastern = dayjs(now).tz(EASTERN_TZ);
  const targetDate = date || nowEastern.format('YYYY-MM-DD');

  const startDateTime = createEasternDate(targetDate, startTime);
  const endDateTime = createEasternDate(targetDate, endTime);

  return now >= startDateTime && now <= endDateTime;
}

/**
 * Calculate minutes between current Eastern Time and a target Eastern Time
 * @param {string} targetTime - Target time (HH:MM:SS)
 * @param {string} date - Date (YYYY-MM-DD), defaults to today
 * @returns {number} - Minutes difference (positive = future, negative = past)
 */
function getMinutesToEasternTime(targetTime, date = null) {
  const now = getCurrentEasternTime();
  const nowEastern = dayjs(now).tz(EASTERN_TZ);
  const targetDate = date || nowEastern.format('YYYY-MM-DD');

  const targetDateTime = createEasternDate(targetDate, targetTime);

  // Check if target date is valid
  if (isNaN(targetDateTime.getTime())) {
    logger.error(`❌ Invalid target date: ${targetDate}T${targetTime}:00`);
    return 0; // Return 0 as fallback
  }

  return Math.round((targetDateTime - now) / (1000 * 60));
}

/**
 * Format Eastern Time for logging
 * @param {Date} easternDate - Date to format in Eastern Time
 * @returns {string} - Formatted string
 */
function formatEasternTime(easternDate) {
  return dayjs(easternDate).tz(EASTERN_TZ).format('YYYY-MM-DD HH:mm:ss');
}

module.exports = {
  toEasternTime,
  createEasternDate,
  getCurrentEasternTime,
  isWithinEasternTimeRange,
  getMinutesToEasternTime,
  formatEasternTime
};
