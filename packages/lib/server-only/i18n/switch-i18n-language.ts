'use server';

import { cookies } from 'next/headers';

// eslint-disable-next-line @typescript-eslint/require-await
export const switchI18NLanguage = async (lang: string) => {
  cookies().set('i18n', lang);
};
