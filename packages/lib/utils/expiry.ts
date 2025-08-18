import type { Recipient } from '@prisma/client';
import { DateTime } from 'luxon';

export const calculateRecipientExpiry = (
  documentExpiryAmount?: number | null,
  documentExpiryUnit?: string | null,
  fromDate: Date = new Date(),
): Date | null => {
  if (!documentExpiryAmount || !documentExpiryUnit) {
    return null;
  }

  switch (documentExpiryUnit) {
    case 'minutes':
      return DateTime.fromJSDate(fromDate).plus({ minutes: documentExpiryAmount }).toJSDate();
    case 'hours':
      return DateTime.fromJSDate(fromDate).plus({ hours: documentExpiryAmount }).toJSDate();
    case 'days':
      return DateTime.fromJSDate(fromDate).plus({ days: documentExpiryAmount }).toJSDate();
    case 'weeks':
      return DateTime.fromJSDate(fromDate).plus({ weeks: documentExpiryAmount }).toJSDate();
    case 'months':
      return DateTime.fromJSDate(fromDate).plus({ months: documentExpiryAmount }).toJSDate();
    default:
      return DateTime.fromJSDate(fromDate).plus({ days: documentExpiryAmount }).toJSDate();
  }
};

export const isRecipientExpired = (recipient: Recipient): boolean => {
  if (!recipient.expired) {
    return false;
  }

  return DateTime.now() > DateTime.fromJSDate(recipient.expired);
};

export const isValidExpirySettings = (
  expiryAmount?: number | null,
  expiryUnit?: string | null,
): boolean => {
  if (!expiryAmount || !expiryUnit) {
    return true;
  }

  return expiryAmount > 0 && ['minutes', 'hours', 'days', 'weeks', 'months'].includes(expiryUnit);
};

export const formatExpiryDate = (date: Date): string => {
  return DateTime.fromJSDate(date).toFormat('MMM dd, yyyy HH:mm');
};
