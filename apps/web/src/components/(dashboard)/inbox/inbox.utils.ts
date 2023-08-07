import { DateTime } from 'luxon';

/**
 * Format the provided date into a readable string for inboxes.
 *
 * @param dateValue The date or date string
 * @returns The date in the current locale, or the date formatted as HH:MM AM/PM if the provided date is after 12:00AM of the current date
 */
export const formatInboxDate = (dateValue: string | Date): string => {
  const date =
    typeof dateValue === 'string' ? DateTime.fromISO(dateValue) : DateTime.fromJSDate(dateValue);

  const startOfTheDay = DateTime.now().startOf('day');

  if (date >= startOfTheDay) {
    return date.toFormat('h:mma');
  }

  return date.toLocaleString({
    ...DateTime.DATE_SHORT,
    year: '2-digit',
  });
};
