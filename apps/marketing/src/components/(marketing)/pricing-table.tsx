'use client';

import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import Link from 'next/link';

import { AnimatePresence, motion } from 'framer-motion';
import { usePlausible } from 'next-plausible';
import { useTranslation } from 'react-i18next';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type PricingTableProps = HTMLAttributes<HTMLDivElement>;

const SELECTED_PLAN_BAR_LAYOUT_ID = 'selected-plan-bar';

export const PricingTable = ({ className, ...props }: PricingTableProps) => {
  const event = usePlausible();
  const { t } = useTranslation();

  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  return (
    <div className={cn('', className)} {...props}>
      <div className="flex items-center justify-center gap-x-6">
        <AnimatePresence>
          <motion.button
            key="MONTHLY"
            className={cn(
              'text-muted-foreground relative flex items-center gap-x-2.5 px-1 py-2.5',
              {
                'text-foreground': period === 'MONTHLY',
                'hover:text-foreground/80': period !== 'MONTHLY',
              },
            )}
            onClick={() => setPeriod('MONTHLY')}
          >
            {t('monthly')}
            {period === 'MONTHLY' && (
              <motion.div
                layoutId={SELECTED_PLAN_BAR_LAYOUT_ID}
                className="bg-primary absolute bottom-0 left-0 h-[3px] w-full rounded-full"
              />
            )}
          </motion.button>

          <motion.button
            key="YEARLY"
            className={cn(
              'text-muted-foreground relative flex items-center gap-x-2.5 px-1 py-2.5',
              {
                'text-foreground': period === 'YEARLY',
                'hover:text-foreground/80': period !== 'YEARLY',
              },
            )}
            onClick={() => setPeriod('YEARLY')}
          >
            {t('yearly')}
            <div className="bg-muted text-foreground block rounded-full px-2 py-0.5 text-xs">
              {t('save_$60')}
            </div>
            {period === 'YEARLY' && (
              <motion.div
                layoutId={SELECTED_PLAN_BAR_LAYOUT_ID}
                className="bg-primary absolute bottom-0 left-0 h-[3px] w-full rounded-full"
              />
            )}
          </motion.button>
        </AnimatePresence>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
        <div
          data-plan="free"
          className="bg-background shadow-foreground/5 flex flex-col items-center justify-center rounded-lg border px-8 py-12 shadow-lg"
        >
          <p className="text-foreground text-4xl font-medium">{t('free_plan')}</p>
          <p className="text-primary mt-2.5 text-xl font-medium">$0</p>

          <p className="text-foreground mt-4 max-w-[30ch] text-center">
            {t('for_small_teams_and_individuals')}
          </p>

          <Button className="rounded-full text-base" asChild>
            <Link
              href={`${process.env.NEXT_PUBLIC_WEBAPP_URL}/signup`}
              target="_blank"
              className="mt-6"
            >
              {`${t('signup_now')}`}
            </Link>
          </Button>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="text-foreground py-4">{t('5 standard documents per month')}</p>
            <p className="text-foreground py-4">{t('Up_to_10_recipients_per_document')}</p>
            <p className="text-foreground py-4">{t('no_credit_card_required')}</p>
          </div>

          <div className="flex-1" />
        </div>

        <div
          data-plan="community"
          className="border-primary bg-background shadow-foreground/5 flex flex-col items-center justify-center rounded-lg border-2 px-8 py-12 shadow-[0px_0px_0px_4px_#E3E3E380]"
        >
          <p className="text-foreground text-4xl font-medium">{t('early_adopters')}</p>
          <div className="text-primary mt-2.5 text-xl font-medium">
            <AnimatePresence mode="wait">
              {period === 'MONTHLY' && <motion.div layoutId="pricing">$30</motion.div>}
              {period === 'YEARLY' && <motion.div layoutId="pricing">$300</motion.div>}
            </AnimatePresence>
          </div>

          <p className="text-foreground mt-4 max-w-[30ch] text-center">
            {t('for_fast_growing_companies')}
          </p>

          <Button className="mt-6 rounded-full text-base" asChild>
            <Link href={`${process.env.NEXT_PUBLIC_WEBAPP_URL}/signup`}>{t('signup_now')}</Link>
          </Button>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="text-foreground py-4 font-medium">
              {' '}
              <a href="https://documenso.com/blog/early-adopters" target="_blank">
                {t('the_early_adopter_deal')}
              </a>
            </p>
            <p className="text-foreground py-4">{t('join_the_movement')}</p>
            <p className="text-foreground py-4">{t('simple_signing_solution')}</p>
            <p className="text-foreground py-4">{t('email_discord_and_slack_assistance')}</p>
            <p className="text-foreground py-4">
              <strong>
                {' '}
                <a href="https://documenso.com/blog/early-adopters" target="_blank">
                  {t('includes_all_upcoming_features')}
                </a>
              </strong>
            </p>
            <p className="text-foreground py-4">{t('fixed_straightforward_pricing')}</p>
          </div>
        </div>

        <div
          data-plan="enterprise"
          className="bg-background shadow-foreground/5 flex flex-col items-center justify-center rounded-lg border px-8 py-12 shadow-lg"
        >
          <p className="text-foreground text-4xl font-medium">{t('enterprise')}</p>
          <p className="text-primary mt-2.5 text-xl font-medium">{t('pricing_on_request')}</p>

          <p className="text-foreground mt-4 max-w-[30ch] text-center">
            {t('for_large_organizations')}
          </p>

          <Link
            href="https://dub.sh/enterprise"
            target="_blank"
            className="mt-6"
            onClick={() => event('enterprise-contact')}
          >
            <Button className="rounded-full text-base">{t('contact_us')}</Button>
          </Link>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="text-foreground py-4 font-medium">{t('everything_in_early_adopters')}</p>
            <p className="text-foreground py-4">{t('custom_subdomain')}</p>
            <p className="text-foreground py-4">{t('compliance_check')}</p>
            <p className="text-foreground py-4">{t('guaranteed_uptime')}</p>
            <p className="text-foreground py-4">{t('reporting_&_analysis')}</p>
            <p className="text-foreground py-4">{t('24/7 Support')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
