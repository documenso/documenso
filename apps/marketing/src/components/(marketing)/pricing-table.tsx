'use client';

import { HTMLAttributes, useState } from 'react';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

import { AnimatePresence, motion } from 'framer-motion';
import { usePlausible } from 'next-plausible';

import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type PricingTableProps = HTMLAttributes<HTMLDivElement>;

const SELECTED_PLAN_BAR_LAYOUT_ID = 'selected-plan-bar';

export const PricingTable = ({ className, ...props }: PricingTableProps) => {
  const locale = useParams()?.locale as LocaleTypes;

  const params = useSearchParams();
  const event = usePlausible();
  const { t } = useTranslation(locale, 'marketing');

  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>(() =>
    params?.get('planId') === process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID
      ? 'YEARLY'
      : 'MONTHLY',
  );

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
            {t(`monthly`)}
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
            {t(`yearly`)}
            <div className="bg-muted text-foreground block rounded-full px-2 py-0.5 text-xs">
              {t(`save`)}
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
          <p className="text-foreground text-4xl font-medium">{t(`free-plan`)}</p>
          <p className="text-primary mt-2.5 text-xl font-medium">{t(`zero`)}</p>

          <p className="text-foreground mt-4 max-w-[30ch] text-center">
            {t(`for-small-individual`)}
          </p>

          <Button className="rounded-full text-base" asChild>
            <Link
              href={`${process.env.NEXT_PUBLIC_WEBAPP_URL}/signup`}
              target="_blank"
              className="mt-6"
            >
              {t(`signup-now`)}
            </Link>
          </Button>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="text-foreground py-4">{t(`5-docs-per-month`)}</p>
            <p className="text-foreground py-4">{t(`10-recipients-per-month`)}</p>
            <p className="text-foreground py-4">{t(`no-cc-required`)}</p>
          </div>

          <div className="flex-1" />
        </div>

        <div
          data-plan="community"
          className="border-primary bg-background shadow-foreground/5 flex flex-col items-center justify-center rounded-lg border-2 px-8 py-12 shadow-[0px_0px_0px_4px_#E3E3E380]"
        >
          <p className="text-foreground text-4xl font-medium">{t(`early-adopters`)}</p>
          <div className="text-primary mt-2.5 text-xl font-medium">
            <AnimatePresence mode="wait">
              {period === 'MONTHLY' && <motion.div layoutId="pricing">{t(`30`)}</motion.div>}
              {period === 'YEARLY' && <motion.div layoutId="pricing">{t(`300`)}</motion.div>}
            </AnimatePresence>
          </div>

          <p className="text-foreground mt-4 max-w-[30ch] text-center">{t(`fast-growing`)}</p>

          <Button className="mt-6 rounded-full text-base" asChild>
            <Link href={`${process.env.NEXT_PUBLIC_WEBAPP_URL}/signup`}>{t(`signup-now`)}</Link>
          </Button>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="text-foreground py-4 font-medium">
              {' '}
              <a href="https://documenso.com/blog/early-adopters" target="_blank">
                {t(`early-adopter-deal`)}
              </a>
            </p>
            <p className="text-foreground py-4">{t(`join-movement`)}</p>
            <p className="text-foreground py-4">{t(`simple-signin`)}</p>
            <p className="text-foreground py-4">{t(`email-discord-slack`)}</p>
            <p className="text-foreground py-4">
              <strong>
                {' '}
                <a href="https://documenso.com/blog/early-adopters" target="_blank">
                  {t(`includes-all`)}
                </a>
              </strong>
            </p>
            <p className="text-foreground py-4">{t(`fixed-pricing`)}</p>
          </div>
        </div>

        <div
          data-plan="enterprise"
          className="bg-background shadow-foreground/5 flex flex-col items-center justify-center rounded-lg border px-8 py-12 shadow-lg"
        >
          <p className="text-foreground text-4xl font-medium">{t(`enterprise`)}</p>
          <p className="text-primary mt-2.5 text-xl font-medium">{t(`pricing-on-request`)}</p>

          <p className="text-foreground mt-4 max-w-[30ch] text-center">{t(`for-large-corp`)}</p>

          <Link
            href="https://dub.sh/enterprise"
            target="_blank"
            className="mt-6"
            onClick={() => event('enterprise-contact')}
          >
            <Button className="rounded-full text-base">{t(`contact-us`)}</Button>
          </Link>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="text-foreground py-4 font-medium">{t(`everything-early-plus`)}</p>
            <p className="text-foreground py-4">{t(`custom-subdomain`)}</p>
            <p className="text-foreground py-4">{t(`compliance-check`)}</p>
            <p className="text-foreground py-4">{t(`guaranteed-uptime`)}</p>
            <p className="text-foreground py-4">{t(`reporting-analysis`)}</p>
            <p className="text-foreground py-4">{t(`24-support`)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
