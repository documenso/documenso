import { DateTime } from 'luxon';

export const DATE_FORMATS = [
  {
    key: 'YYYYMMDD',
    label: 'YYYY-MM-DD',
    value: 'yyyy-MM-dd hh:mm a',
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

export const splitTimeZone = (input: string | null): string => {
  if (input === null) {
    return '';
  }
  const indexGMT = input.indexOf('GMT');
  if (indexGMT !== -1) {
    return input.slice(0, indexGMT).trim();
  }
  return input;
};

export const convertToLocalSystemFormat = (
  customText: string,
  dateFormat: string | null = 'yyyy-MM-dd hh:mm a',
  timeZone: string | null = 'Etc/UTC',
): string => {
  const localTimeZone = splitTimeZone(timeZone);
  const selectedFormat = DATE_FORMATS.find((format) => format.value === dateFormat);

  if (!selectedFormat) {
    return 'Invalid date format value';
  }

  const parsedDate = DateTime.fromFormat(customText, selectedFormat.value);
  if (!parsedDate.isValid) {
    return 'Invalid date';
  }
  const formattedDate = parsedDate.setZone(localTimeZone).toFormat(selectedFormat.value);

  return formattedDate;
};
