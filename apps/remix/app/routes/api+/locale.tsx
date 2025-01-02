import type { ActionFunctionArgs } from 'react-router';

import { APP_I18N_OPTIONS } from '@documenso/lib/constants/i18n';

import { langCookie } from '~/storage/lang-cookie.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const lang = formData.get('lang') || '';

  if (!APP_I18N_OPTIONS.supportedLangs.find((l) => l === lang)) {
    throw new Response('Unsupported language', { status: 400 });
  }

  return new Response('OK', {
    status: 200,
    headers: { 'Set-Cookie': await langCookie.serialize(lang) },
  });
};
