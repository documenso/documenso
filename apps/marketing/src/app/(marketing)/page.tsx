/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import type { Metadata } from 'next';
import { Caveat } from 'next/font/google';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { cn } from '@documenso/ui/lib/utils';

import { FasterSmarterBeautifulBento } from '~/components/(marketing)/faster-smarter-beautiful-bento';
import { Hero } from '~/components/(marketing)/hero';

export const revalidate = 600;
export const metadata: Metadata = {
  title: {
    absolute: 'Documenso - The Open Source DocuSign Alternative',
  },
};

const fontCaveat = Caveat({
  weight: ['500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
});

export default async function IndexPage() {
  await setupI18nSSR();

  return (
    <div className={cn('mt-12', fontCaveat.variable)}>
      <Hero />
      <FasterSmarterBeautifulBento className="my-48" />
    </div>
  );
}
