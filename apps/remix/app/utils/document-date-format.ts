import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DateTime } from 'luxon';

export const formatDocumentDate = (date: Date, dateFormat?: string | null, locale?: string) => {
  const dateTime = DateTime.fromJSDate(date);

  return (locale ? dateTime.setLocale(locale) : dateTime).toFormat(dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT);
};
