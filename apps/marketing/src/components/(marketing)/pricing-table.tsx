'use client';

import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import Link from 'next/link';

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
            Monthly
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
            Yearly
            <div className="bg-muted text-foreground block rounded-full px-2 py-0.5 text-xs">
              Save $60 or $120
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
          <p className="text-foreground text-4xl font-medium">Free</p>
          <p className="text-primary mt-2.5 text-xl font-medium">$0</p>

          <p className="text-foreground mt-4 max-w-[30ch] text-center">
            For small teams and individuals with basic needs.
          </p>

          <Button className="rounded-full text-base" asChild>
            <Link
              href={`${NEXT_PUBLIC_WEBAPP_URL()}/signup?utm_source=pricing-free-plan`}
              target="_blank"
              className="mt-6"
            >
              Signup Now
            </Link>
          </Button>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="text-foreground py-4">5 standard documents per month</p>
            <p className="text-foreground py-4">Up to 10 recipients per document</p>
            <p className="text-foreground py-4">No credit card required</p>
          </div>

          <div className="flex-1" />
        </div>

        <div
          data-plan="individual"
          className="bg-background shadow-foreground/5 flex flex-col items-center justify-center rounded-lg border-2 px-8 py-12 shadow-[0px_0px_0px_4px_#E3E3E380]"
        >
          <p className="text-foreground text-4xl font-medium">Individual</p>
          <div className="text-primary mt-2.5 text-xl font-medium">
            <AnimatePresence mode="wait">
              {period === 'MONTHLY' && <motion.div layoutId="pricing">$30</motion.div>}
              {period === 'YEARLY' && <motion.div layoutId="pricing">$300</motion.div>}
            </AnimatePresence>
          </div>

          <p className="text-foreground mt-4 max-w-[30ch] text-center">
            Everything you need for a great signing experience.
          </p>

          <Button className="mt-6 rounded-full text-base" asChild>
            <Link
              href={`${NEXT_PUBLIC_WEBAPP_URL()}/signup?utm_source=pricing-individual-plan`}
              target="_blank"
            >
              Signup Now
            </Link>
          </Button>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="text-foreground py-4">Unlimited Documents per Month</p>
            <p className="text-foreground py-4">API Accesss</p>
            <p className="text-foreground py-4">Email and Discord Support</p>
            <p className="text-foreground py-4">Premium Profile Name</p>
          </div>
          <div className="flex-1" />
        </div>

        <div
          data-plan="teams"
          className="border-primary bg-background shadow-foreground/5 flex flex-col items-center justify-center rounded-lg border px-8 py-12 shadow-lg"
        >
          <p className="text-foreground text-4xl font-medium">Teams</p>
          <div className="text-primary mt-2.5 text-xl font-medium">
            <AnimatePresence mode="wait">
              {period === 'MONTHLY' && <motion.div layoutId="pricingTeams">$50</motion.div>}
              {period === 'YEARLY' && <motion.div layoutId="pricingTeams">$480</motion.div>}
            </AnimatePresence>
          </div>

          <p className="text-foreground mt-4 max-w-[30ch] text-center">
            For companies looking to scale across multiple teams.
          </p>

          <Button className="mt-6 rounded-full text-base" asChild>
            <Link
              href={`${NEXT_PUBLIC_WEBAPP_URL()}/signup?utm_source=pricing-teams-plan`}
              target="_blank"
            >
              Signup Now
            </Link>
          </Button>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="text-foreground py-4">Unlimited Documents per Month</p>
            <p className="text-foreground py-4">API Accesss</p>
            <p className="text-foreground py-4">Email and Discord Support</p>
            <p className="text-foreground py-4 font-medium">Team Inbox</p>
            <p className="text-foreground py-4">5 Users Included</p>
            <p className="text-foreground py-4">
              Add More Users for {period === 'MONTHLY' ? '$10/ mo.' : '$96/ yr.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
