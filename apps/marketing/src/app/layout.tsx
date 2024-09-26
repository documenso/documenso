import { Suspense } from 'react';

import { Caveat, Inter } from 'next/font/google';

import { AxiomWebVitals } from 'next-axiom';
import { PublicEnvScript } from 'next-runtime-env';

import { FeatureFlagProvider } from '@documenso/lib/client-only/providers/feature-flag';
import { I18nClientProvider } from '@documenso/lib/client-only/providers/i18n.client';
import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { NEXT_PUBLIC_MARKETING_URL } from '@documenso/lib/constants/app';
import { getAllAnonymousFlags } from '@documenso/lib/universal/get-feature-flag';
import { TrpcProvider } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Toaster } from '@documenso/ui/primitives/toaster';

import { ThemeProvider } from '~/providers/next-theme';
import { PlausibleProvider } from '~/providers/plausible';
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
    metadataBase: new URL(NEXT_PUBLIC_MARKETING_URL() ?? 'http://localhost:3000'),
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
  const flags = await getAllAnonymousFlags();

  const { lang, locales, i18n } = setupI18nSSR();

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
        <meta name="google" content="notranslate" />
        <PublicEnvScript />
      </head>

      <AxiomWebVitals />

      <Suspense>
        <PostHogPageview />
      </Suspense>

      <body>
        <FeatureFlagProvider initialFlags={flags}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <PlausibleProvider>
              <TrpcProvider>
                <I18nClientProvider
                  initialLocaleData={{ lang, locales }}
                  initialMessages={i18n.messages}
                >
                  {children}
                </I18nClientProvider>
              </TrpcProvider>
            </PlausibleProvider>
          </ThemeProvider>
        </FeatureFlagProvider>

        <Toaster />
      </body>
    </html>
  );
}
