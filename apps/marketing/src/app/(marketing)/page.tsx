/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import { Caveat } from 'next/font/google';

import { cn } from '@documenso/ui/lib/utils';

import { Callout } from '~/components/(marketing)/callout';
import { FasterSmarterBeautifulBento } from '~/components/(marketing)/faster-smarter-beautiful-bento';
import { Hero } from '~/components/(marketing)/hero';
import { OpenBuildTemplateBento } from '~/components/(marketing)/open-build-template-bento';
import { ShareConnectPaidWidgetBento } from '~/components/(marketing)/share-connect-paid-widget-bento';

const fontCaveat = Caveat({
  weight: ['500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
});

export default async function IndexPage() {
  return (
    <div className={cn('mt-12', fontCaveat.variable)}>
      <Hero />

      <FasterSmarterBeautifulBento className="my-48" />
      <ShareConnectPaidWidgetBento className="my-48" />
      <OpenBuildTemplateBento className="my-48" />

      <Callout />
    </div>
  );
}
