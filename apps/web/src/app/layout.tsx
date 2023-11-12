import { Suspense } from 'react';

import { Caveat, Inter } from 'next/font/google';

import { FeatureFlagProvider } from '@documenso/lib/client-only/providers/feature-flag';
import { LocaleProvider } from '@documenso/lib/client-only/providers/locale';
import { getServerComponentAllFlags } from '@documenso/lib/server-only/feature-flags/get-server-component-feature-flag';
import { getLocale } from '@documenso/lib/server-only/headers/get-locale';
import { RuntimeEnvProvider } from '@documenso/lib/universal/runtime-env';
import { getRuntimeEnv } from '@documenso/lib/universal/runtime-env/get-runtime-env';
import { TrpcProvider } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Toaster } from '@documenso/ui/primitives/toaster';
import { TooltipProvider } from '@documenso/ui/primitives/tooltip';

import { ThemeProvider } from '~/providers/next-theme';
import { PlausibleProvider } from '~/providers/plausible';
import { PostHogPageview } from '~/providers/posthog';

import './globals.css';

export const dynamic = 'force-dynamic';

const fontInter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const fontCaveat = Caveat({ subsets: ['latin'], variable: '--font-signature' });

// We do this so NEXT_PUBLIC variables will be evaluated at runtime.
// eslint-disable-next-line @typescript-eslint/require-await
export const generateMetadata = async () => {
  const { NEXT_PUBLIC_WEBAPP_URL } = getRuntimeEnv();

  return {
    title: 'Documenso - The Open Source DocuSign Alternative',
    description:
      'Join Documenso, the open signing infrastructure, and get a 10x better signing experience. Pricing starts at $30/mo. forever! Sign in now and enjoy a faster, smarter, and more beautiful document signing process. Integrates with your favorite tools, customizable, and expandable. Support our mission and become a part of our open-source community.',
    keywords:
      'Documenso, open source, DocuSign alternative, document signing, open signing infrastructure, open-source community, fast signing, beautiful signing, smart templates',
    authors: { name: 'Documenso, Inc.' },
    robots: 'index, follow',
    openGraph: {
      title: 'Documenso - The Open Source DocuSign Alternative',
      description:
        'Join Documenso, the open signing infrastructure, and get a 10x better signing experience. Pricing starts at $30/mo. forever! Sign in now and enjoy a faster, smarter, and more beautiful document signing process. Integrates with your favorite tools, customizable, and expandable. Support our mission and become a part of our open-source community.',
      type: 'website',
      images: [`${NEXT_PUBLIC_WEBAPP_URL}/opengraph-image.jpg`],
    },
    twitter: {
      site: '@documenso',
      card: 'summary_large_image',
      images: [`${NEXT_PUBLIC_WEBAPP_URL}/opengraph-image.jpg`],
      description:
        'Join Documenso, the open signing infrastructure, and get a 10x better signing experience. Pricing starts at $30/mo. forever! Sign in now and enjoy a faster, smarter, and more beautiful document signing process. Integrates with your favorite tools, customizable, and expandable. Support our mission and become a part of our open-source community.',
    },
  };
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const flags = await getServerComponentAllFlags();

  const locale = getLocale();

  return (
    <html
      lang="en"
      className={cn(fontInter.variable, fontCaveat.variable)}
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>

      <Suspense>
        <PostHogPageview />
      </Suspense>

      <body>
        <RuntimeEnvProvider>
          <LocaleProvider locale={locale}>
            <FeatureFlagProvider initialFlags={flags}>
              <PlausibleProvider>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                  <TooltipProvider>
                    <TrpcProvider>{children}</TrpcProvider>
                  </TooltipProvider>
                </ThemeProvider>
              </PlausibleProvider>

              <Toaster />
            </FeatureFlagProvider>
          </LocaleProvider>
        </RuntimeEnvProvider>
      </body>
    </html>
  );
}
