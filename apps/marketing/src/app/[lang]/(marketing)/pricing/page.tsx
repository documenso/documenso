import type { Metadata } from 'next';
import Link from 'next/link';

import { getDictionary } from 'get-dictionary';

import type { Locale } from '@documenso/lib/internationalization/i18n-config';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';
import { Button } from '@documenso/ui/primitives/button';

import { Enterprise } from '~/components/(marketing)/enterprise';
import { PricingTable } from '~/components/(marketing)/pricing-table';

export const metadata: Metadata = {
  title: 'Pricing',
};

export const dynamic = 'force-dynamic';

export type PricingPageProps = {
  searchParams?: {
    planId?: string;
    email?: string;
    name?: string;
    cancelled?: string;
  };
};

export default async function PricingPage({ params: { lang } }: { params: { lang: Locale } }) {
  const dictionary = await getDictionary(lang);
  return (
    <div className="mt-6 sm:mt-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold lg:text-5xl">{dictionary.pricing.pricing}</h1>

        <p className="text-foreground mt-4 text-lg leading-normal">{dictionary.pricing.designed}</p>
        <p className="text-foreground text-lg leading-normal">
          {dictionary.pricing.get_started_today}
        </p>
      </div>

      <div className="mt-12">
        <PricingTable dictionary={dictionary.pricing} />
      </div>

      <div className="mt-12">
        <Enterprise dictionary={dictionary.pricing} />
      </div>

      <div className="mx-auto mt-36 max-w-2xl">
        <h2 className="text-center text-2xl font-semibold">{dictionary.pricing.none_work}</h2>

        <p className="text-muted-foreground mt-4 text-center leading-relaxed">
          {dictionary.pricing.self_hosted}
        </p>

        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="lg" className="rounded-full hover:cursor-pointer" asChild>
            <Link href="https://github.com/documenso/documenso" target="_blank" rel="noreferrer">
              {dictionary.pricing.get_started}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-36 max-w-2xl">
        {/* FAQ Section */}

        <h2 className="text-4xl font-semibold">{dictionary.pricing.faq}</h2>

        <Accordion type="multiple" className="mt-8">
          <AccordionItem value="plan-differences">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {dictionary.pricing.plan_difference}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {dictionary.pricing.painless}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="data-handling">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {dictionary.pricing.handle_data}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {dictionary.pricing.securely}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="should-use-cloud">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {dictionary.pricing.why_hosting}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {dictionary.pricing.using_hosted}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="how-to-contribute">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {dictionary.pricing.how_contribute}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {dictionary.pricing.awesome}{' '}
              <Link
                className="text-documenso-700 font-bold"
                href="https://github.com/documenso/documenso/milestones"
                target="_blank"
              >
                {dictionary.pricing.issues}
              </Link>{' '}
              {dictionary.pricing.join}{' '}
              <Link
                className="text-documenso-700 font-bold"
                href="https://documen.so/discord"
                target="_blank"
              >
                {dictionary.pricing.discord_community}
              </Link>{' '}
              {dictionary.pricing.keep_up_to_date} ❤️
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="can-i-use-documenso-commercially">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {dictionary.pricing.can_i_use}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {dictionary.pricing.under_the_gnu}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="why-prefer-documenso">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {dictionary.pricing.why_documenso}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {dictionary.pricing.vibrant_ecosystem}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="where-can-i-get-support">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {dictionary.pricing.where_get_support}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {dictionary.pricing.we_are_happy}{' '}
              <Link
                className="text-documenso-700 font-bold"
                target="_blank"
                rel="noreferrer"
                href="mailto:support@documenso.com"
              >
                support@documenso.com
              </Link>{' '}
              {dictionary.pricing.or}{' '}
              <a
                className="text-documenso-700 font-bold"
                href="https://documen.so/discord"
                target="_blank"
                rel="noreferrer"
              >
                {dictionary.pricing.in_our_discord}
              </a>{' '}
              {dictionary.pricing.please_message}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
