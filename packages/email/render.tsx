import type { I18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import * as ReactEmail from '@react-email/render';

import config from '@documenso/tailwind-config';

import { Tailwind } from './components';
import { BrandingProvider, type BrandingSettings } from './providers/branding';

export type RenderOptions = ReactEmail.Options & {
  branding?: BrandingSettings;
  i18n?: I18n;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const colors = (config.theme?.extend?.colors || {}) as Record<string, string>;

export const render = (element: React.ReactNode, options?: RenderOptions) => {
  const { branding, ...otherOptions } = options ?? {};

  return ReactEmail.render(
    <BrandingProvider branding={branding}>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors,
            },
          },
        }}
      >
        {element}
      </Tailwind>
    </BrandingProvider>,
    otherOptions,
  );
};

export const renderWithI18N = (element: React.ReactNode, options?: RenderOptions) => {
  const { branding, i18n, ...otherOptions } = options ?? {};

  if (!i18n) {
    throw new Error('i18n is required');
  }

  return ReactEmail.render(
    <I18nProvider i18n={i18n}>
      <BrandingProvider branding={branding}>
        <Tailwind
          config={{
            theme: {
              extend: {
                colors,
              },
            },
          }}
        >
          {element}
        </Tailwind>
      </BrandingProvider>
    </I18nProvider>,
    otherOptions,
  );
};

export const renderAsync = async (element: React.ReactNode, options?: RenderOptions) => {
  const { branding, ...otherOptions } = options ?? {};

  return await ReactEmail.renderAsync(
    <BrandingProvider branding={branding}>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors,
            },
          },
        }}
      >
        {element}
      </Tailwind>
    </BrandingProvider>,
    otherOptions,
  );
};
