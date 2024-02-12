'use server';

import {cookies} from 'next/headers';
import {LANGUAGE_COOKIE} from '@documenso/lib/i18n/settings';

export async function switchLocaleAction(value: string) {
  cookies().set(LANGUAGE_COOKIE, value);

  // It does not matter what we return here
  return {
    status: 'success',
  };
}
