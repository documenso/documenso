import { I18nProvider } from '@lingui/react';

import type { RenderOptions } from '@documenso/email/render';
import { render } from '@documenso/email/render';

import { getI18nInstance } from '../client-only/providers/i18n-server';
import {
  APP_I18N_OPTIONS,
  type SupportedLanguageCodes,
  isValidLanguageCode,
} from '../constants/i18n';

export const renderEmailWithI18N = async (
  component: React.ReactElement,
  options?: RenderOptions & {
    // eslint-disable-next-line @typescript-eslint/ban-types
    lang?: SupportedLanguageCodes | (string & {});
  },
) => {
  try {
    const { lang: providedLang, ...otherOptions } = options ?? {};

    const lang = isValidLanguageCode(providedLang) ? providedLang : APP_I18N_OPTIONS.sourceLang;

    const i18n = await getI18nInstance(lang);

    i18n.activate(lang);

    return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>, otherOptions);
  } catch (err) {
    console.error(err);
    throw new Error('Failed to render email');
  }
};
