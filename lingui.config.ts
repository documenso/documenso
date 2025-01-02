import { defineConfig } from '@lingui/cli';
import type { LinguiConfig } from '@lingui/conf';
import { formatter } from '@lingui/format-po';

import { APP_I18N_OPTIONS } from '@documenso/lib/constants/i18n';

const config: LinguiConfig = {
  sourceLocale: APP_I18N_OPTIONS.sourceLang,
  locales: APP_I18N_OPTIONS.supportedLangs as unknown as string[],
  // Any changes to these catalogue paths should be reflected in crowdin.yml
  catalogs: [
    {
      path: '<rootDir>/packages/lib/translations/{locale}/web',
      include: ['apps/remix/app', 'packages/ui', 'packages/lib', 'packages/email'],
      exclude: ['**/node_modules/**'],
    },
  ],
  compileNamespace: 'es',
  format: formatter({ lineNumbers: false }),
};

export default config;
