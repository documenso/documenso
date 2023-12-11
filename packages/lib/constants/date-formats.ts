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
];

export const splitDateFormat = (dateString: string): string => {
  const dateParts: string[] = dateString.split(' ');
  const date: string = dateParts[0];
  return date;
};
