import type { LinguiConfig } from '@lingui/conf';

import { APP_I18N_OPTIONS } from '@documenso/lib/constants/i18n';

// Extends root lingui.config.cjs.
const config: LinguiConfig = {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  locales: APP_I18N_OPTIONS.supportedLngs as unknown as string[],
  catalogs: [
    {
      path: '<rootDir>/../../packages/lib/translations/web/{locale}',
      include: ['<rootDir>/../../packages/lib/translations/web'],
    },
    {
      path: '<rootDir>/../../packages/lib/translations/common/{locale}',
      include: ['<rootDir>/../../packages/lib/translations/common'],
    },
  ],
  catalogsMergePath: '<rootDir>/../../packages/lib/translations/web/compiled/{locale}',
};

export default config;
