import { differenceInDays, differenceInMonths, differenceInWeeks } from 'date-fns';

export const calculatePeriod = (expiryDate: Date) => {
  const now = new Date();
  const daysDiff = differenceInDays(expiryDate, now);
  const weeksDiff = differenceInWeeks(expiryDate, now);
  const monthsDiff = differenceInMonths(expiryDate, now);

  if (monthsDiff > 0) {
    return { amount: monthsDiff, unit: 'months' as const };
  } else if (weeksDiff > 0) {
    return { amount: weeksDiff, unit: 'weeks' as const };
  } else {
    return { amount: daysDiff, unit: 'days' as const };
  }
};
