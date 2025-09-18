import { DateTime } from 'luxon';

import { DEFAULT_DOCUMENT_TIME_ZONE } from './time-zones';

export const DEFAULT_DOCUMENT_DATE_FORMAT = 'yyyy-MM-dd hh:mm a';

export const VALID_DATE_FORMAT_VALUES = [
  DEFAULT_DOCUMENT_DATE_FORMAT,
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'MM/dd/yyyy',
  'dd.MM.yyyy',
  'yy-MM-dd',
  'MMMM dd, yyyy',
  'EEEE, MMMM dd, yyyy',
  'dd/MM/yyyy hh:mm a',
  'MM/dd/yyyy hh:mm a',
  'dd.MM.yyyy HH:mm',
  'yyyy-MM-dd HH:mm',
  'yy-MM-dd hh:mm a',
  'yyyy-MM-dd HH:mm:ss',
  'MMMM dd, yyyy hh:mm a',
  'EEEE, MMMM dd, yyyy hh:mm a',
  "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
] as const;

export type ValidDateFormat = (typeof VALID_DATE_FORMAT_VALUES)[number];

export const DATE_FORMATS = [
  {
    key: 'yyyy-MM-dd_hh:mm_a',
    label: 'YYYY-MM-DD HH:mm a',
    value: DEFAULT_DOCUMENT_DATE_FORMAT,
  },
  {
    key: 'DDMMYYYY_TIME',
    label: 'DD/MM/YYYY HH:mm a',
    value: 'dd/MM/yyyy hh:mm a',
  },
  {
    key: 'MMDDYYYY_TIME',
    label: 'MM/DD/YYYY HH:mm a',
    value: 'MM/dd/yyyy hh:mm a',
  },
  {
    key: 'DDMMYYYYHHMM',
    label: 'DD.MM.YYYY HH:mm',
    value: 'dd.MM.yyyy HH:mm',
  },
  {
    key: 'YYYYMMDDHHmm',
    label: 'YYYY-MM-DD HH:mm',
    value: 'yyyy-MM-dd HH:mm',
  },
  {
    key: 'YYMMDD_TIME',
    label: 'YY-MM-DD HH:mm a',
    value: 'yy-MM-dd hh:mm a',
  },
  {
    key: 'YYYYMMDDhhmmss',
    label: 'YYYY-MM-DD HH:mm:ss',
    value: 'yyyy-MM-dd HH:mm:ss',
  },
  {
    key: 'MonthDateYear_TIME',
    label: 'Month Date, Year HH:mm a',
    value: 'MMMM dd, yyyy hh:mm a',
  },
  {
    key: 'DayMonthYear_TIME',
    label: 'Day, Month Year HH:mm a',
    value: 'EEEE, MMMM dd, yyyy hh:mm a',
  },
  {
    key: 'ISO8601',
    label: 'ISO 8601',
    value: "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
  },
  {
    key: 'YYYYMMDD',
    label: 'YYYY-MM-DD',
    value: 'yyyy-MM-dd',
  },
  {
    key: 'DDMMYYYY',
    label: 'DD/MM/YYYY',
    value: 'dd/MM/yyyy',
  },
  {
    key: 'MMDDYYYY',
    label: 'MM/DD/YYYY',
    value: 'MM/dd/yyyy',
  },
  {
    key: 'DDMMYYYY_DOT',
    label: 'DD.MM.YYYY',
    value: 'dd.MM.yyyy',
  },
  {
    key: 'YYMMDD',
    label: 'YY-MM-DD',
    value: 'yy-MM-dd',
  },
  {
    key: 'MonthDateYear',
    label: 'Month Date, Year',
    value: 'MMMM dd, yyyy',
  },
  {
    key: 'DayMonthYear',
    label: 'Day, Month Year',
    value: 'EEEE, MMMM dd, yyyy',
  },
] satisfies {
  key: string;
  label: string;
  value: (typeof VALID_DATE_FORMAT_VALUES)[number];
}[];

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

export const isValidDateFormat = (dateFormat: unknown): dateFormat is ValidDateFormat => {
  return VALID_DATE_FORMAT_VALUES.includes(dateFormat as ValidDateFormat);
};
