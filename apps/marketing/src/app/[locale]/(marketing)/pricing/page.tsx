import type { Metadata } from 'next';
import Link from 'next/link';

import type { PageParams } from '@documenso/lib/types/page-params';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';
import { Button } from '@documenso/ui/primitives/button';

import initTranslations from '~/app/i18n';
import { PricingTable } from '~/components/(marketing)/pricing-table';

export const metadata: Metadata = {
  title: 'Pricing',
};

export type PricingPageProps = {
  searchParams?: {
    planId?: string;
    email?: string;
    name?: string;
    cancelled?: string;
  };
};

export default async function PricingPage({ params: { locale } }: PageParams) {
  const { t } = await initTranslations(locale);
  return (
    <div className="mt-6 sm:mt-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold lg:text-5xl">{t('pricing')}</h1>

        <p className="text-foreground mt-4 text-lg leading-normal">
          {t('designed_for_every_stage')}
        </p>
        <p className="text-foreground text-lg leading-normal">{t('get_started_today')}</p>
      </div>

      <div className="mt-12">
        <PricingTable />
      </div>

      <div className="mx-auto mt-36 max-w-2xl">
        <h2 className="text-center text-2xl font-semibold">{t('none_of_these_work_for_you')}</h2>

        <p className="text-muted-foreground mt-4 text-center leading-relaxed">
          {t('our_self_hosted_option_is_great')}
        </p>

        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="lg" className="rounded-full hover:cursor-pointer" asChild>
            <Link href="https://github.com/documenso/documenso" target="_blank">
              {t('get_started')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-36 max-w-2xl">
        {/* FAQ Section */}

        <h2 className="text-4xl font-semibold">{t('faqs')}</h2>

        <Accordion type="multiple" className="mt-8">
          <AccordionItem value="plan-differences">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t('difference_between_plans')}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t('you_can_self_host_documenso_for_free')}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="data-handling">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t('how_do_you_handle_my_data')}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t('our_data_center_is_located_in_frankfurt')}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="should-use-cloud">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t('why_should_i_use_your_hosting_service')}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t('using_our_hosted_version_is_easiest_way')}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="how-to-contribute">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t('how_can_i_contribute')}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t('you_can_take_a_look_at_the_current')}{' '}
              <Link
                className="text-documenso-700 font-bold"
                href="https://github.com/documenso/documenso/milestones"
                target="_blank"
              >
                {t('issues')}
              </Link>{' '}
              {t('and_join_our')}{' '}
              <Link
                className="text-documenso-700 font-bold"
                href="https://documen.so/discord"
                target="_blank"
              >
                {t('discord_community')}
              </Link>{' '}
              {t('to_keep_up_to_date')}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="can-i-use-documenso-commercially">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t('can_i_use_documenso_commercially')}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t('documenso_is_offered_under_the_gnu_agpl_v3')}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="why-prefer-documenso">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t('why_should_i_prefer_documenso')}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t('documenso_is_a_community_effort')}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="where-can-i-get-support">
            <AccordionTrigger className="text-left text-lg font-semibold">
              {t('where_can_i_get_support')}
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t('we_are_happy_to_assist_you_at')}{' '}
              <Link
                className="text-documenso-700 font-bold"
                target="_blank"
                href="mailto:support@documenso.com"
              >
                support@documenso.com
              </Link>{' '}
              or{' '}
              <a
                className="text-documenso-700 font-bold"
                href="https://documen.so/discord"
                target="_blank"
              >
                {t('in_our_discord_Support_Channel')}
              </a>{' '}
              {t('message_either_lucas_or_timur')}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
