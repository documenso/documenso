/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import type { Metadata } from 'next';
import { Caveat } from 'next/font/google';

import { getDictionary } from 'get-dictionary';
import type { Locale } from 'i18n-config';

import { cn } from '@documenso/ui/lib/utils';

import { Callout } from '~/components/(marketing)/callout';
import { FasterSmarterBeautifulBento } from '~/components/(marketing)/faster-smarter-beautiful-bento';
import { Hero } from '~/components/(marketing)/hero';
import { OpenBuildTemplateBento } from '~/components/(marketing)/open-build-template-bento';
import { ShareConnectPaidWidgetBento } from '~/components/(marketing)/share-connect-paid-widget-bento';

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

export default async function IndexPage({ params: { lang } }: { params: { lang: Locale } }) {
  const starCount = await fetch('https://api.github.com/repos/documenso/documenso', {
    headers: {
      accept: 'application/vnd.github.v3+json',
    },
  })
    .then(async (res) => res.json())
    .then((res) => (typeof res.stargazers_count === 'number' ? res.stargazers_count : undefined))
    .catch(() => undefined);
  const dictionary = await getDictionary(lang);

  return (
    <div className={cn('mt-12', fontCaveat.variable)}>
      <Hero starCount={starCount} dictionary={dictionary.hero} />

      <FasterSmarterBeautifulBento
        className="my-48"
        dictionary={dictionary.bento.faster_smarter_beautiful}
      />
      <ShareConnectPaidWidgetBento
        className="my-48"
        dictionary={dictionary.bento.share_connect_paid_widget}
      />
      <OpenBuildTemplateBento className="my-48" dictionary={dictionary.bento.open_build_template} />

      <Callout starCount={starCount} dictionary={dictionary.hero} />
    </div>
  );
}
