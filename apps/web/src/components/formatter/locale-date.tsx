'use client';

import { HTMLAttributes, useEffect, useState } from 'react';

import { DateTime, DateTimeFormatOptions } from 'luxon';

import { useLocale } from '@documenso/lib/client-only/providers/locale';

export type LocaleDateProps = HTMLAttributes<HTMLSpanElement> & {
  date: string | number | Date;
  format?: DateTimeFormatOptions;
};

/**
 * Formats the date based on the user locale.
 *
 * Will use the estimated locale from the user headers on SSR, then will use
 * the client browser locale once mounted.
 */
export const LocaleDate = ({ className, date, format, ...props }: LocaleDateProps) => {
  const { locale } = useLocale();

  const [localeDate, setLocaleDate] = useState(() =>
    DateTime.fromJSDate(new Date(date)).setLocale(locale).toLocaleString(format),
  );

  useEffect(() => {
    setLocaleDate(DateTime.fromJSDate(new Date(date)).toLocaleString(format));
  }, [date, format]);

  return (
    <span className={className} {...props}>
      {localeDate}
    </span>
  );
};
