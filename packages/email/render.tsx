import * as ReactEmail from '@react-email/render';

import config from '@documenso/tailwind-config';

import { Tailwind } from './components';
import { BrandingProvider, type BrandingSettings } from './providers/branding';

export type RenderOptions = ReactEmail.Options & {
  branding?: BrandingSettings;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const colors = (config.theme?.extend?.colors || {}) as Record<string, string>;

export const render = (element: React.ReactNode, options?: RenderOptions) => {
  const { branding, ...otherOptions } = options ?? {};

  return ReactEmail.render(
    <Tailwind
      config={{
        theme: {
          extend: {
            colors,
          },
        },
      }}
    >
      <BrandingProvider branding={branding}>{element}</BrandingProvider>
    </Tailwind>,
    otherOptions,
  );
};

export const renderAsync = async (element: React.ReactNode, options?: RenderOptions) => {
  const { branding, ...otherOptions } = options ?? {};

  return await ReactEmail.renderAsync(
    <Tailwind
      config={{
        theme: {
          extend: {
            colors,
          },
        },
      }}
    >
      <BrandingProvider branding={branding}>{element}</BrandingProvider>
    </Tailwind>,
    otherOptions,
  );
};
