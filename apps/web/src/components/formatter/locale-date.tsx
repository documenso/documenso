'use client';

<<<<<<< HEAD
import { HTMLAttributes, useEffect, useState } from 'react';

import { DateTime, DateTimeFormatOptions } from 'luxon';
=======
import type { HTMLAttributes } from 'react';
import { useCallback, useEffect, useState } from 'react';

import type { DateTimeFormatOptions } from 'luxon';
import { DateTime } from 'luxon';
>>>>>>> main

import { useLocale } from '@documenso/lib/client-only/providers/locale';

export type LocaleDateProps = HTMLAttributes<HTMLSpanElement> & {
  date: string | number | Date;
<<<<<<< HEAD
  format?: DateTimeFormatOptions;
=======
  format?: DateTimeFormatOptions | string;
>>>>>>> main
};

/**
 * Formats the date based on the user locale.
 *
 * Will use the estimated locale from the user headers on SSR, then will use
 * the client browser locale once mounted.
 */
export const LocaleDate = ({ className, date, format, ...props }: LocaleDateProps) => {
  const { locale } = useLocale();

<<<<<<< HEAD
  const [localeDate, setLocaleDate] = useState(() =>
    DateTime.fromJSDate(new Date(date)).setLocale(locale).toLocaleString(format),
  );

  useEffect(() => {
    setLocaleDate(DateTime.fromJSDate(new Date(date)).toLocaleString(format));
  }, [date, format]);
=======
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
>>>>>>> main

  return (
    <span className={className} {...props}>
      {localeDate}
    </span>
  );
};
