import { Suspense } from 'react';

import { Caveat, Inter } from 'next/font/google';
import { cookies, headers } from 'next/headers';

import { AxiomWebVitals } from 'next-axiom';
import { PublicEnvScript } from 'next-runtime-env';

import { FeatureFlagProvider } from '@documenso/lib/client-only/providers/feature-flag';
import { I18nClientProvider } from '@documenso/lib/client-only/providers/i18n.client';
import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { LocaleProvider } from '@documenso/lib/client-only/providers/locale';
import { IS_APP_WEB_I18N_ENABLED, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import type { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { ZSupportedLanguageCodeSchema } from '@documenso/lib/constants/i18n';
import { getServerComponentAllFlags } from '@documenso/lib/server-only/feature-flags/get-server-component-feature-flag';
import { getLocale } from '@documenso/lib/server-only/headers/get-locale';
import { TrpcProvider } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Toaster } from '@documenso/ui/primitives/toaster';
import { TooltipProvider } from '@documenso/ui/primitives/tooltip';

import { ThemeProvider } from '~/providers/next-theme';
import { PostHogPageview } from '~/providers/posthog';

import './globals.css';

const fontInter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const fontCaveat = Caveat({ subsets: ['latin'], variable: '--font-signature' });

export function generateMetadata() {
  return {
    title: {
      template: '%s - Documenso',
      default: 'Documenso',
    },
    description:
      'Join Documenso, the open signing infrastructure, and get a 10x better signing experience. Pricing starts at $30/mo. forever! Sign in now and enjoy a faster, smarter, and more beautiful document signing process. Integrates with your favorite tools, customizable, and expandable. Support our mission and become a part of our open-source community.',
    keywords:
      'Documenso, open source, DocuSign alternative, document signing, open signing infrastructure, open-source community, fast signing, beautiful signing, smart templates',
    authors: { name: 'Documenso, Inc.' },
    robots: 'index, follow',
    metadataBase: new URL(NEXT_PUBLIC_WEBAPP_URL() ?? 'http://localhost:3000'),
    openGraph: {
      title: 'Documenso - The Open Source DocuSign Alternative',
      description:
        'Join Documenso, the open signing infrastructure, and get a 10x better signing experience. Pricing starts at $30/mo. forever! Sign in now and enjoy a faster, smarter, and more beautiful document signing process. Integrates with your favorite tools, customizable, and expandable. Support our mission and become a part of our open-source community.',
      type: 'website',
      images: ['/opengraph-image.jpg'],
    },
    twitter: {
      site: '@documenso',
      card: 'summary_large_image',
      images: ['/opengraph-image.jpg'],
      description:
        'Join Documenso, the open signing infrastructure, and get a 10x better signing experience. Pricing starts at $30/mo. forever! Sign in now and enjoy a faster, smarter, and more beautiful document signing process. Integrates with your favorite tools, customizable, and expandable. Support our mission and become a part of our open-source community.',
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const flags = await getServerComponentAllFlags();

  const locale = getLocale();

  let overrideLang: (typeof SUPPORTED_LANGUAGE_CODES)[number] | undefined;

  // Should be safe to remove when we upgrade NextJS.
  // https://github.com/vercel/next.js/pull/65008
  // Currently if the middleware sets the cookie, it's not accessible in the cookies
  // during the same render.
  // So we go the roundabout way of checking the header for the set-cookie value.
  if (!cookies().get('i18n')) {
    const setCookieValue = headers().get('set-cookie');
    const i18nCookie = setCookieValue?.split(';').find((cookie) => cookie.startsWith('i18n='));

    if (i18nCookie) {
      const i18n = i18nCookie.split('=')[1];

      overrideLang = ZSupportedLanguageCodeSchema.parse(i18n);
    }
  }

  // Disable i18n for now until we get translations.
  if (!IS_APP_WEB_I18N_ENABLED) {
    overrideLang = 'en';
  }

  const { lang, i18n } = setupI18nSSR(overrideLang);

  return (
    <html
      lang={lang}
      className={cn(fontInter.variable, fontCaveat.variable)}
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        {IS_APP_WEB_I18N_ENABLED && <meta name="google" content="notranslate" />}
        <PublicEnvScript />
      </head>

      <AxiomWebVitals />

      <Suspense>
        <PostHogPageview />
      </Suspense>

      <body>
        <LocaleProvider locale={locale}>
          <FeatureFlagProvider initialFlags={flags}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <TooltipProvider>
                <TrpcProvider>
                  <I18nClientProvider initialLocale={lang} initialMessages={i18n.messages}>
                    {children}
                  </I18nClientProvider>
                </TrpcProvider>
              </TooltipProvider>
            </ThemeProvider>

            <Toaster />
          </FeatureFlagProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
