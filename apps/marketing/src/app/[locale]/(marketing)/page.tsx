/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import { Caveat } from 'next/font/google';

import { cn } from '@documenso/ui/lib/utils';

import { Callout } from '~/components/(marketing)/callout';
import { FasterSmarterBeautifulBento } from '~/components/(marketing)/faster-smarter-beautiful-bento';
import { Hero } from '~/components/(marketing)/hero';
import { OpenBuildTemplateBento } from '~/components/(marketing)/open-build-template-bento';
import { ShareConnectPaidWidgetBento } from '~/components/(marketing)/share-connect-paid-widget-bento';

export const revalidate = 600;

const fontCaveat = Caveat({
  weight: ['500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
});

export default async function IndexPage() {
  const starCount = await fetch('https://api.github.com/repos/documenso/documenso', {
    headers: {
      accept: 'application/vnd.github.v3+json',
    },
  })
    .then(async (res) => res.json())
    .then((res) => (typeof res.stargazers_count === 'number' ? res.stargazers_count : undefined))
    .catch(() => undefined);

  return (
    <div className={cn('mt-12', fontCaveat.variable)}>
      <Hero starCount={starCount} />

      <FasterSmarterBeautifulBento className="my-48" />
      <ShareConnectPaidWidgetBento className="my-48" />
      <OpenBuildTemplateBento className="my-48" />

      <Callout starCount={starCount} />
    </div>
  );
}
