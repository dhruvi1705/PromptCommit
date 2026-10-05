// Standardized Date and Time Formatter for PromptCommit
// Preferred format: "Aug 05, 2026, 04:30 PM" or short format: "05 Aug 2026"

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Parses any date-like input into a valid Date object.
 * Returns null if parsing fails or if the input is a status string (e.g. "Active", "Pending").
 */
export const parseToDate = (input) => {
  if (!input) return null;
  if (input instanceof Date && !isNaN(input.getTime())) return input;

  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Do NOT convert status strings into current timestamps!
    // A status is not a timestamp.
    if (/^(active|pending|inactive|draft|in_review|changes_requested|approved|archived|live|just joined)$/i.test(trimmed)) {
      return null;
    }

    // Handle "Today at 10:30 AM" or "Yesterday at 04:15 PM"
    const todayMatch = trimmed.match(/^today at (\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (todayMatch) {
      const now = new Date();
      let hours = parseInt(todayMatch[1], 10);
      const minutes = parseInt(todayMatch[2], 10);
      const meridiem = todayMatch[3]?.toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      now.setHours(hours, minutes, 0, 0);
      return now;
    }

    const yestMatch = trimmed.match(/^yesterday at (\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (yestMatch) {
      const now = new Date();
      now.setDate(now.getDate() - 1);
      let hours = parseInt(yestMatch[1], 10);
      const minutes = parseInt(yestMatch[2], 10);
      const meridiem = yestMatch[3]?.toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      now.setHours(hours, minutes, 0, 0);
      return now;
    }

    // Standard string parsing (ISO 8601, YYYY-MM-DD, etc.)
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
};

/**
 * Formats date into standard preferred format: "Aug 05, 2026, 04:30 PM"
 */
export const formatDateTime = (dateInput, fallback = 'Date unavailable') => {
  const d = parseToDate(dateInput);
  if (!d) return fallback;

  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const formattedHours = String(hours).padStart(2, '0');

  return `${month} ${day}, ${year}, ${formattedHours}:${minutes} ${ampm}`;
};

export const formatDate = formatDateTime;

/**
 * Formats date into shorter display: "05 Aug 2026"
 */
export const formatDateShort = (dateInput, fallback = 'Date unavailable') => {
  const d = parseToDate(dateInput);
  if (!d) return fallback;

  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();

  return `${day} ${month} ${year}`;
};

/**
 * Formats date into "Aug 05, 2026"
 */
export const formatDateMedium = (dateInput, fallback = 'Date unavailable') => {
  const d = parseToDate(dateInput);
  if (!d) return fallback;

  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();

  return `${month} ${day}, ${year}`;
};

/**
 * Formats time only: "04:30 PM"
 */
export const formatTimeOnly = (dateInput, fallback = 'Time unavailable') => {
  const d = parseToDate(dateInput);
  if (!d) return fallback;

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');

  return `${formattedHours}:${minutes} ${ampm}`;
};

/**
 * Formats a valid timestamp relative to now (e.g. "Just now", "5m ago", "2h ago", "Yesterday")
 */
export const formatRelativeTime = (dateInput, fallback = 'Date unavailable') => {
  const d = parseToDate(dateInput);
  if (!d) return fallback;

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) {
    return formatDateMedium(d, fallback);
  }

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDateMedium(d, fallback);
};

/**
 * Returns current timestamp in standard ISO string suitable for storage
 */
export const getCurrentTimestamp = () => new Date().toISOString();
