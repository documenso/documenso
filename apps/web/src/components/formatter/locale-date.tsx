'use client';

import type { HTMLAttributes } from 'react';
import { useCallback, useEffect, useState } from 'react';

import type { DateTimeFormatOptions } from 'luxon';
import { DateTime } from 'luxon';

import { useLocale } from '@documenso/lib/client-only/providers/locale';

export type LocaleDateProps = HTMLAttributes<HTMLSpanElement> & {
  date: string | number | Date;
  format?: DateTimeFormatOptions | string;
};

/**
 * Formats the date based on the user locale.
 *
 * Will use the estimated locale from the user headers on SSR, then will use
 * the client browser locale once mounted.
 */
export const LocaleDate = ({ className, date, format, ...props }: LocaleDateProps) => {
  const { locale } = useLocale();

  const formatDateTime = useCallback(
    (date: DateTime) => {
      if (typeof format === 'string') {
        return date.toFormat(format);
      }

      return date.toLocaleString(format);
    },
    [format],
  );

  const [localeDate, setLocaleDate] = useState(() =>
    formatDateTime(DateTime.fromJSDate(new Date(date)).setLocale(locale)),
  );

  useEffect(() => {
    setLocaleDate(formatDateTime(DateTime.fromJSDate(new Date(date))));
  }, [date, format, formatDateTime]);

  return (
    <span className={className} {...props}>
      {localeDate}
    </span>
  );
};
