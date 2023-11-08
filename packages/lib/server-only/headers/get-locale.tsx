import { headers } from 'next/headers';

export const getLocale = () => {
  const headerItems = headers();

  const locales = headerItems.get('accept-language') ?? 'en-US';

  const [locale] = locales.split(',');

  return locale;
};
