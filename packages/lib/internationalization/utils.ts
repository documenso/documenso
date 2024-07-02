import type { stringLocales } from './i18n-config';

export const dateFormatter = (stringLocale: stringLocales, date: Date) =>
  new Intl.DateTimeFormat(stringLocale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

export const currencyFormatter = (stringLocale: stringLocales, value: number) =>
  new Intl.NumberFormat(stringLocale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
