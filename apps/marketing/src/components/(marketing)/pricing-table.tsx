'use client';

import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import Link from 'next/link';

import { Trans } from '@lingui/macro';
import { AnimatePresence, motion } from 'framer-motion';
import { usePlausible } from 'next-plausible';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type PricingTableProps = HTMLAttributes<HTMLDivElement>;

const SELECTED_PLAN_BAR_LAYOUT_ID = 'selected-plan-bar';

export const PricingTable = ({ className, ...props }: PricingTableProps) => {
  const event = usePlausible();

  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  return (
    <div className={cn('', className)} {...props}>
      <div className="bg-background sticky top-32 flex items-center justify-end gap-x-6 shadow-[-1px_-5px_2px_6px_hsl(var(--background))] md:top-[7.5rem] lg:static lg:justify-center">
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
            <Trans>Monthly</Trans>
            {period === 'MONTHLY' && (
              <motion.div
                layoutId={SELECTED_PLAN_BAR_LAYOUT_ID}
                className="bg-foreground lg:bg-primary absolute bottom-0 left-0 h-[3px] w-full rounded-full"
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
            <Trans>Yearly</Trans>
            <div className="bg-muted text-foreground block rounded-full px-2 py-0.5 text-xs">
              <Trans>Save $60 or $120</Trans>
            </div>
            {period === 'YEARLY' && (
              <motion.div
                layoutId={SELECTED_PLAN_BAR_LAYOUT_ID}
                className="bg-foreground lg:bg-primary absolute bottom-0 left-0 h-[3px] w-full rounded-full"
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
          <p className="text-foreground text-4xl font-medium">
            <Trans>Free</Trans>
          </p>
          <p className="text-primary mt-2.5 text-xl font-medium">$0</p>

          <p className="text-foreground mt-4 max-w-[30ch] text-center">
            <Trans>For small teams and individuals with basic needs.</Trans>
          </p>

          <Button className="rounded-full text-base" asChild>
            <Link
              href={`${NEXT_PUBLIC_WEBAPP_URL()}/signup?utm_source=pricing-free-plan`}
              target="_blank"
              className="mt-6"
            >
              <Trans>Signup Now</Trans>
            </Link>
          </Button>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="text-foreground py-4">
              <Trans>5 standard documents per month</Trans>
            </p>
            <p className="text-foreground py-4">
              <Trans>Up to 10 recipients per document</Trans>
            </p>
            <p className="text-foreground py-4">
              <Trans>No credit card required</Trans>
            </p>
          </div>

          <div className="flex-1" />
        </div>

        <div
          data-plan="individual"
          className="bg-background shadow-foreground/5 flex flex-col items-center justify-center rounded-lg border-2 px-8 py-12 shadow-[0px_0px_0px_4px_#E3E3E380]"
        >
          <p className="text-foreground text-4xl font-medium">
            <Trans>Individual</Trans>
          </p>
          <div className="text-primary mt-2.5 text-xl font-medium">
            <AnimatePresence mode="wait">
              {period === 'MONTHLY' && <motion.div layoutId="pricing">$30</motion.div>}
              {period === 'YEARLY' && <motion.div layoutId="pricing">$300</motion.div>}
            </AnimatePresence>
          </div>

          <p className="text-foreground mt-4 max-w-[30ch] text-center">
            <Trans>Everything you need for a great signing experience.</Trans>
          </p>

          <Button className="mt-6 rounded-full text-base" asChild>
            <Link
              href={`${NEXT_PUBLIC_WEBAPP_URL()}/signup?utm_source=pricing-individual-plan`}
              target="_blank"
            >
              <Trans>Signup Now</Trans>
            </Link>
          </Button>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="text-foreground py-4">
              <Trans>Unlimited Documents per Month</Trans>
            </p>
            <p className="text-foreground py-4">
              <Trans>API Access</Trans>
            </p>
            <p className="text-foreground py-4">
              <Trans>Email and Discord Support</Trans>
            </p>
            <p className="text-foreground py-4">
              <Trans>Premium Profile Name</Trans>
            </p>
          </div>
          <div className="flex-1" />
        </div>

        <div
          data-plan="teams"
          className="border-primary bg-background shadow-foreground/5 flex flex-col items-center justify-center rounded-lg border px-8 py-12 shadow-lg"
        >
          <p className="text-foreground text-4xl font-medium">
            <Trans>Teams</Trans>
          </p>
          <div className="text-primary mt-2.5 text-xl font-medium">
            <AnimatePresence mode="wait">
              {period === 'MONTHLY' && <motion.div layoutId="pricingTeams">$50</motion.div>}
              {period === 'YEARLY' && <motion.div layoutId="pricingTeams">$480</motion.div>}
            </AnimatePresence>
          </div>

          <p className="text-foreground mt-4 max-w-[30ch] text-center">
            <Trans>For companies looking to scale across multiple teams.</Trans>
          </p>

          <Button className="mt-6 rounded-full text-base" asChild>
            <Link
              href={`${NEXT_PUBLIC_WEBAPP_URL()}/signup?utm_source=pricing-teams-plan`}
              target="_blank"
            >
              <Trans>Signup Now</Trans>
            </Link>
          </Button>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="text-foreground py-4">
              <Trans>Unlimited Documents per Month</Trans>
            </p>
            <p className="text-foreground py-4">
              <Trans>API Access</Trans>
            </p>
            <p className="text-foreground py-4">
              <Trans>Email and Discord Support</Trans>
            </p>
            <p className="text-foreground py-4 font-medium">
              <Trans>Team Inbox</Trans>
            </p>
            <p className="text-foreground py-4">
              <Trans>5 Users Included</Trans>
            </p>
            <p className="text-foreground py-4">
              <Trans>Add More Users for {period === 'MONTHLY' ? '$10/ mo.' : '$96/ yr.'}</Trans>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
