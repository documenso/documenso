'use client';

import { HTMLAttributes, useEffect, useState } from 'react';

export type LocaleDateProps = HTMLAttributes<HTMLSpanElement> & {
  date: string | number | Date;
};

export const LocaleDate = ({ className, date, ...props }: LocaleDateProps) => {
  const [localeDate, setLocaleDate] = useState(() => new Date(date).toISOString());

  useEffect(() => {
    setLocaleDate(new Date(date).toLocaleString());
  }, [date]);

  return (
    <span className={className} {...props}>
      {localeDate}
    </span>
  );
};
