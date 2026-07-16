import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import PlausibleProvider from 'next-plausible';

import './global.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://docs.documenso.com'),
  title: {
    template: '%s | Documenso Docs',
    default: 'Documenso Docs',
  },
  description: 'The official documentation for Documenso, the open-source document signing platform.',
  openGraph: {
    siteName: 'Documenso Docs',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@documenso',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={dmSans.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <PlausibleProvider domain="documenso.com">
          <RootProvider>{children}</RootProvider>
        </PlausibleProvider>
      </body>
    </html>
  );
}
