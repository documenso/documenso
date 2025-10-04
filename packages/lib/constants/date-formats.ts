import { DateTime } from 'luxon';

import { DEFAULT_DOCUMENT_TIME_ZONE } from './time-zones';

export const DEFAULT_DOCUMENT_DATE_FORMAT = 'yyyy-MM-dd hh:mm a';
const NOW_DATE = DateTime.local();

export const VALID_DATE_FORMAT_VALUES = [
  DEFAULT_DOCUMENT_DATE_FORMAT,
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'MM/dd/yyyy',
  'yy-MM-dd',
  'MMMM dd, yyyy',
  'EEEE, MMMM dd, yyyy',
  'dd/MM/yyyy hh:mm a',
  'dd/MM/yyyy HH:mm',
  'MM/dd/yyyy hh:mm a',
  'MM/dd/yyyy HH:mm',
  'dd.MM.yyyy',
  'dd.MM.yyyy HH:mm',
  'yyyy-MM-dd HH:mm',
  'yy-MM-dd hh:mm a',
  'yy-MM-dd HH:mm',
  'yyyy-MM-dd HH:mm:ss',
  'MMMM dd, yyyy hh:mm a',
  'MMMM dd, yyyy HH:mm',
  'EEEE, MMMM dd, yyyy hh:mm a',
  'EEEE, MMMM dd, yyyy HH:mm',
  "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
] as const;

export type ValidDateFormat = (typeof VALID_DATE_FORMAT_VALUES)[number];

export const DATE_FORMATS = [
  {
    key: 'yyyy-MM-dd_HH:mm_12H',
    label: `YYYY-MM-DD hh:mm AM/PM (${NOW_DATE.toFormat('yyyy-MM-dd hh:mm a')})`,
    value: DEFAULT_DOCUMENT_DATE_FORMAT,
  },
  {
    key: 'yyyy-MM-dd_HH:mm',
    label: `YYYY-MM-DD HH:mm (${NOW_DATE.toFormat('yyyy-MM-dd HH:mm')})`,
    value: 'yyyy-MM-dd HH:mm',
  },
  {
    key: 'DDMMYYYY_TIME',
    label: `DD/MM/YYYY HH:mm (${NOW_DATE.toFormat('dd/MM/yyyy HH:mm')})`,
    value: 'dd/MM/yyyy HH:mm',
  },
  {
    key: 'DDMMYYYY_TIME_12H',
    label: `DD/MM/YYYY hh:mm AM/PM (${NOW_DATE.toFormat('dd/MM/yyyy hh:mm a')})`,
    value: 'dd/MM/yyyy hh:mm a',
  },
  {
    key: 'MMDDYYYY_TIME',
    label: `MM/DD/YYYY HH:mm (${NOW_DATE.toFormat('MM/dd/yyyy HH:mm')})`,
    value: 'MM/dd/yyyy HH:mm',
  },
  {
    key: 'MMDDYYYY_TIME_12H',
    label: `MM/DD/YYYY hh:mm AM/PM (${NOW_DATE.toFormat('MM/dd/yyyy hh:mm a')})`,
    value: 'MM/dd/yyyy hh:mm a',
  },
  {
    key: 'DDMMYYYYHHMM',
    label: `DD.MM.YYYY HH:mm (${NOW_DATE.toFormat('dd.MM.yyyy HH:mm')})`,
    value: 'dd.MM.yyyy HH:mm',
  },
  {
    key: 'YYMMDD_TIME',
    label: `YY-MM-DD HH:mm (${NOW_DATE.toFormat('yy-MM-dd HH:mm')})`,
    value: 'yy-MM-dd HH:mm',
  },
  {
    key: 'YYMMDD_TIME_12H',
    label: `YY-MM-DD hh:mm AM/PM (${NOW_DATE.toFormat('yy-MM-dd hh:mm a')})`,
    value: 'yy-MM-dd hh:mm a',
  },
  {
    key: 'YYYY_MM_DD_HH_MM_SS',
    label: `YYYY-MM-DD HH:mm:ss (${NOW_DATE.toFormat('yyyy-MM-dd HH:mm:ss')})`,
    value: 'yyyy-MM-dd HH:mm:ss',
  },
  {
    key: 'MonthDateYear_TIME',
    label: `Month Date, Year HH:mm (${NOW_DATE.toFormat('MMMM dd, yyyy HH:mm')})`,
    value: 'MMMM dd, yyyy HH:mm',
  },
  {
    key: 'MonthDateYear_TIME_12H',
    label: `Month Date, Year hh:mm AM/PM (${NOW_DATE.toFormat('MMMM dd, yyyy hh:mm a')})`,
    value: 'MMMM dd, yyyy hh:mm a',
  },
  {
    key: 'DayMonthYear_TIME',
    label: `Day, Month Year HH:mm (${NOW_DATE.toFormat('EEEE, MMMM dd, yyyy HH:mm')})`,
    value: 'EEEE, MMMM dd, yyyy HH:mm',
  },
  {
    key: 'DayMonthYear_TIME_12H',
    label: `Day, Month Year hh:mm AM/PM (${NOW_DATE.toFormat('EEEE, MMMM dd, yyyy hh:mm a')})`,
    value: 'EEEE, MMMM dd, yyyy hh:mm a',
  },
  {
    key: 'ISO8601',
    label: `ISO 8601 (${NOW_DATE.toISO()})`,
    value: "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
  },
  {
    key: 'YYYYMMDD',
    label: `YYYY-MM-DD (${NOW_DATE.toFormat('yyyy-MM-dd')})`,
    value: 'yyyy-MM-dd',
  },
  {
    key: 'DDMMYYYY',
    label: `DD/MM/YYYY (${NOW_DATE.toFormat('dd/MM/yyyy')})`,
    value: 'dd/MM/yyyy',
  },
  {
    key: 'MMDDYYYY',
    label: `MM/DD/YYYY (${NOW_DATE.toFormat('MM/dd/yyyy')})`,
    value: 'MM/dd/yyyy',
  },
  {
    key: 'DDMMYYYY_DOT',
    label: `DD.MM.YYYY (${NOW_DATE.toFormat('dd.MM.yyyy')})`,
    value: 'dd.MM.yyyy',
  },
  {
    key: 'YYMMDD',
    label: `YY-MM-DD (${NOW_DATE.toFormat('yy-MM-dd')})`,
    value: 'yy-MM-dd',
  },
  {
    key: 'MonthDateYear',
    label: `Month Date, Year (${NOW_DATE.toFormat('MMMM dd, yyyy')})`,
    value: 'MMMM dd, yyyy',
  },
  {
    key: 'DayMonthYear',
    label: `Day, Month Year (${NOW_DATE.toFormat('EEEE, MMMM dd, yyyy')})`,
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
