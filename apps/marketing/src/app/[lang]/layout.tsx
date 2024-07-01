import { Suspense } from 'react';

import { Caveat, Inter } from 'next/font/google';

import { getDictionary } from 'get-dictionary';
import { type Locale, i18n } from 'i18n-config';
import { AxiomWebVitals } from 'next-axiom';
import { PublicEnvScript } from 'next-runtime-env';

import { FeatureFlagProvider } from '@documenso/lib/client-only/providers/feature-flag';
import { NEXT_PUBLIC_MARKETING_URL } from '@documenso/lib/constants/app';
import { getAllAnonymousFlags } from '@documenso/lib/universal/get-feature-flag';
import { TrpcProvider } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Toaster } from '@documenso/ui/primitives/toaster';

import DictionaryProvider from '~/providers/dictionary-provider';
import { ThemeProvider } from '~/providers/next-theme';
import { PlausibleProvider } from '~/providers/plausible';
import { PostHogPageview } from '~/providers/posthog';

import './globals.css';

const fontInter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const fontCaveat = Caveat({ subsets: ['latin'], variable: '--font-signature' });

export function generateStaticParams() {
  return i18n.locales.map((locale) => ({ lang: locale }));
}

export async function generateMetadata({ params }: { params: { lang: Locale } }) {
  const dictionary = await getDictionary(params.lang);
  return {
    title: {
      template: '%s - Documenso',
      default: 'Documenso',
    },
    description: dictionary.metadata.description,
    keywords: dictionary.metadata.keywords,
    authors: { name: 'Documenso, Inc.' },
    robots: 'index, follow',
    metadataBase: new URL(NEXT_PUBLIC_MARKETING_URL() ?? 'http://localhost:3000'),
    openGraph: {
      title: dictionary.metadata.title,
      description: dictionary.metadata.description,
      type: 'website',
      images: ['/opengraph-image.jpg'],
    },
    twitter: {
      site: '@documenso',
      card: 'summary_large_image',
      images: ['/opengraph-image.jpg'],
      description: dictionary.metadata.description,
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: Locale };
}) {
  const flags = await getAllAnonymousFlags();
  const dictionary = await getDictionary(params.lang);

  return (
    <html
      lang={params.lang}
      className={cn(fontInter.variable, fontCaveat.variable)}
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <PublicEnvScript />
      </head>

      <AxiomWebVitals />

      <Suspense>
        <PostHogPageview />
      </Suspense>

      <body>
        <DictionaryProvider dictionary={dictionary}>
          <FeatureFlagProvider initialFlags={flags}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <PlausibleProvider>
                <TrpcProvider>{children}</TrpcProvider>
              </PlausibleProvider>
            </ThemeProvider>
          </FeatureFlagProvider>
        </DictionaryProvider>
        <Toaster />
      </body>
    </html>
  );
}
