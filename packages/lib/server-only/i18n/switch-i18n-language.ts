'use server';

import { cookies } from 'next/headers';

// eslint-disable-next-line @typescript-eslint/require-await
export const switchI18NLanguage = async (lang: string) => {
  // Two year expiry.
  const maxAge = 60 * 60 * 24 * 365 * 2;

  cookies().set('language', lang, { maxAge });
};
