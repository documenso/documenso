import { DateTime } from 'luxon';

import { DEFAULT_DOCUMENT_TIME_ZONE } from './time-zones';

export const DEFAULT_DOCUMENT_DATE_FORMAT = 'yyyy-MM-dd hh:mm a';

export const DATE_FORMATS = [
  {
    key: 'yyyy-MM-dd_hh:mm_a',
    label: 'YYYY-MM-DD HH:mm a',
    value: DEFAULT_DOCUMENT_DATE_FORMAT,
  },
  {
    key: 'YYYYMMDD',
    label: 'YYYY-MM-DD',
    value: 'YYYY-MM-DD',
  },
  {
    key: 'DDMMYYYY',
    label: 'DD/MM/YYYY',
    value: 'dd/MM/yyyy hh:mm a',
  },
  {
    key: 'MMDDYYYY',
    label: 'MM/DD/YYYY',
    value: 'MM/dd/yyyy hh:mm a',
  },
  {
    key: 'YYYYMMDDHHmm',
    label: 'YYYY-MM-DD HH:mm',
    value: 'yyyy-MM-dd HH:mm',
  },
  {
    key: 'YYMMDD',
    label: 'YY-MM-DD',
    value: 'yy-MM-dd hh:mm a',
  },
  {
    key: 'YYYYMMDDhhmmss',
    label: 'YYYY-MM-DD HH:mm:ss',
    value: 'yyyy-MM-dd HH:mm:ss',
  },
  {
    key: 'MonthDateYear',
    label: 'Month Date, Year',
    value: 'MMMM dd, yyyy hh:mm a',
  },
  {
    key: 'DayMonthYear',
    label: 'Day, Month Year',
    value: 'EEEE, MMMM dd, yyyy hh:mm a',
  },
  {
    key: 'ISO8601',
    label: 'ISO 8601',
    value: "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
  },
];

export const convertToLocalSystemFormat = (
  customText: string,
  dateFormat: string | null = DEFAULT_DOCUMENT_DATE_FORMAT,
  timeZone: string | null = DEFAULT_DOCUMENT_TIME_ZONE,
): string => {
  const coalescedDateFormat = dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT;
  const coalescedTimeZone = timeZone ?? DEFAULT_DOCUMENT_TIME_ZONE;

  const parsedDate = DateTime.fromFormat(customText, coalescedDateFormat, {
    zone: coalescedTimeZone,
  });

  if (!parsedDate.isValid) {
    return 'Invalid date';
  }

  const formattedDate = parsedDate.toLocal().toFormat(coalescedDateFormat);

  return formattedDate;
};
