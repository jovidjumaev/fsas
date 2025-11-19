const { createLogger } = require('./lib/logger');
const logger = createLogger('Backend');

// =====================================================
// EASTERN TIME UTILITY FUNCTIONS
// =====================================================

/**
 * Convert a UTC date/time to Eastern Time
 * @param {Date} utcDate - The UTC date to convert
 * @returns {Date} - The date in Eastern Time
 */
function toEasternTime(utcDate) {
  // Eastern Time is UTC-4 (EDT) or UTC-5 (EST)
  // For simplicity, we'll use EDT (UTC-4) year-round
  const easternOffset = -4 * 60; // EDT offset in minutes
  return new Date(utcDate.getTime() + (easternOffset * 60 * 1000));
}

/**
 * Create a date in Eastern Time from date and time strings
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} time - Time string (HH:MM:SS)
 * @returns {Date} - The date in Eastern Time
 */
function createEasternDate(date, time) {
  // Ensure proper time format
  const timeString = time.includes(':') ? time : `${time}:00`;
  
  // Parse the date and time components
  const [year, month, day] = date.split('-');
  const [hour, minute, second] = timeString.split(':');
  
  // Create a date string in Eastern Time format
  // Use the format: YYYY-MM-DDTHH:MM:SS-04:00 (EDT)
  const easternDateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${(second || '00').padStart(2, '0')}-04:00`;
  
  const easternDate = new Date(easternDateString);
  
  // Check if the date is valid
  if (isNaN(easternDate.getTime())) {
    logger.error(`❌ Invalid date created: ${easternDateString}`);
    return new Date(); // Return current time as fallback
  }
  
  return easternDate;
}

/**
 * Get current time in Eastern Time
 * @returns {Date} - Current time in Eastern Time
 */
function getCurrentEasternTime() {
  const now = new Date();
  
  // Use toLocaleString to get Eastern Time, then parse it back to a Date
  // This is more reliable than manual offset calculation
  const easternTimeString = now.toLocaleString("en-US", {timeZone: "America/New_York"});
  
  // Parse the Eastern Time string back to a Date object
  // Format: "10/18/2025, 11:46:07 PM"
  const [datePart, timePart] = easternTimeString.split(', ');
  const [month, day, year] = datePart.split('/');
  const [time, period] = timePart.split(' ');
  const [hour, minute, second] = time.split(':');
  
  // Convert 12-hour to 24-hour format
  let hour24 = parseInt(hour);
  if (period === 'PM' && hour24 !== 12) {
    hour24 += 12;
  } else if (period === 'AM' && hour24 === 12) {
    hour24 = 0;
  }
  
  // Create a Date object in Eastern Time
  const easternDate = new Date(year, month - 1, day, hour24, minute, second);
  
  return easternDate;
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
  const targetDate = date || now.toISOString().split('T')[0];
  
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
  const targetDate = date || now.toISOString().split('T')[0];
  
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
 * @param {Date} easternDate - Date in Eastern Time
 * @returns {string} - Formatted string
 */
function formatEasternTime(easternDate) {
  return easternDate.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

module.exports = {
  toEasternTime,
  createEasternDate,
  getCurrentEasternTime,
  isWithinEasternTimeRange,
  getMinutesToEasternTime,
  formatEasternTime
};
