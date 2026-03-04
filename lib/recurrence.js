// Recurrence utilities for recurring todos

/**
 * Calculate the next due date based on recurrence pattern
 * @param {string} currentDueDate - Current due date in ISO format
 * @param {object} recurrence - Recurrence pattern object
 * @returns {string} - Next due date in ISO format (YYYY-MM-DD)
 */
export function calculateNextDueDate(currentDueDate, recurrence) {
  if (!recurrence || !currentDueDate) return null;

  const current = new Date(currentDueDate);
  let next = new Date(current);

  switch (recurrence.type) {
    case 'daily':
      next.setDate(next.getDate() + (recurrence.interval || 1));
      break;

    case 'weekly':
      next.setDate(next.getDate() + (recurrence.interval || 1) * 7);
      break;

    case 'weekday':
      // Skip to next weekday (Mon-Fri)
      next.setDate(next.getDate() + 1);
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case 'monthly':
      if (recurrence.dayOfMonth) {
        // Repeat on specific day of month (e.g., "2nd of each month")
        next.setMonth(next.getMonth() + (recurrence.interval || 1));
        next.setDate(recurrence.dayOfMonth);
      } else {
        // Repeat same day of month
        const dayOfMonth = current.getDate();
        next.setMonth(next.getMonth() + (recurrence.interval || 1));
        next.setDate(dayOfMonth);
        // Handle month overflow (e.g., Jan 31 -> Feb 28)
        if (next.getDate() !== dayOfMonth) {
          next.setDate(0); // Set to last day of previous month
        }
      }
      break;

    case 'yearly':
      next.setFullYear(next.getFullYear() + (recurrence.interval || 1));
      break;

    default:
      return null;
  }

  // Return date in YYYY-MM-DD format
  return next.toISOString().split('T')[0];
}

/**
 * Parse recurrence object from JSON string
 * @param {string} recurrenceStr - JSON string or null
 * @returns {object|null} - Parsed recurrence object or null
 */
export function parseRecurrence(recurrenceStr) {
  if (!recurrenceStr) return null;
  try {
    return JSON.parse(recurrenceStr);
  } catch (e) {
    return null;
  }
}

/**
 * Get human-readable description of recurrence pattern
 * @param {object} recurrence - Recurrence pattern object
 * @returns {string} - Human-readable description
 */
export function getRecurrenceDescription(recurrence) {
  if (!recurrence) return '';

  const interval = recurrence.interval || 1;
  const prefix = interval > 1 ? `Every ${interval} ` : 'Every ';

  switch (recurrence.type) {
    case 'daily':
      return interval === 1 ? 'Every day' : `${prefix}days`;

    case 'weekly':
      return interval === 1 ? 'Every week' : `${prefix}weeks`;

    case 'weekday':
      return 'Every weekday (Mon - Fri)';

    case 'monthly':
      if (recurrence.dayOfMonth) {
        const day = recurrence.dayOfMonth;
        const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
        return interval === 1
          ? `Every month on the ${day}${suffix}`
          : `${prefix}months on the ${day}${suffix}`;
      }
      return interval === 1 ? 'Every month' : `${prefix}months`;

    case 'yearly':
      return interval === 1 ? 'Every year' : `${prefix}years`;

    default:
      return '';
  }
}
