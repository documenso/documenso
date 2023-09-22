import { Inter } from 'next/font/google';

import { Toaster } from '@documenso/ui/primitives/toaster';

import { PlausibleProvider } from '~/providers/plausible';

import './globals.css';

const fontInter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata = {
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
    images: [`${process.env.NEXT_PUBLIC_MARKETING_URL}/opengraph-image.jpg`],
  },
  twitter: {
    site: '@documenso',
    card: 'summary_large_image',
    images: [`${process.env.NEXT_PUBLIC_MARKETING_URL}/opengraph-image.jpg`],
    description:
      'Join Documenso, the open signing infrastructure, and get a 10x better signing experience. Pricing starts at $30/mo. forever! Sign in now and enjoy a faster, smarter, and more beautiful document signing process. Integrates with your favorite tools, customizable, and expandable. Support our mission and become a part of our open-source community.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontInter.variable} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>

      <body>
        <PlausibleProvider>{children}</PlausibleProvider>
        <Toaster />
      </body>
    </html>
  );
}
