import type { stringLocales } from '../internationalization/i18n-config';

export const formatMonth = (monthStr: string, stringLocale: stringLocales = 'en-US') =>
  new Intl.DateTimeFormat(stringLocale, {
    year: 'numeric',
    month: 'long',
  }).format(new Date(monthStr));
