'use client';

import { HTMLAttributes, useMemo, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { AnimatePresence, motion } from 'framer-motion';
import { usePlausible } from 'next-plausible';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { ClaimPlanDialog } from './claim-plan-dialog';

export type PricingTableProps = HTMLAttributes<HTMLDivElement>;

const SELECTED_PLAN_BAR_LAYOUT_ID = 'selected-plan-bar';

export const PricingTable = ({ className, ...props }: PricingTableProps) => {
  const params = useSearchParams();
  const event = usePlausible();

  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>(() =>
    params?.get('planId') === process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID
      ? 'YEARLY'
      : 'MONTHLY',
  );

  const planId = useMemo(() => {
    if (period === 'MONTHLY') {
      return process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID;
    }

    return process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID;
  }, [period]);

  return (
    <div className={cn('', className)} {...props}>
      <div className="flex items-center justify-center gap-x-6">
        <AnimatePresence>
          <motion.button
            key="MONTHLY"
            className={cn('relative flex items-center gap-x-2.5 px-1 py-2.5 text-[#727272]', {
              'text-slate-900': period === 'MONTHLY',
              'hover:text-slate-900/80': period !== 'MONTHLY',
            })}
            onClick={() => setPeriod('MONTHLY')}
          >
            Monthly
            {period === 'MONTHLY' && (
              <motion.div
                layoutId={SELECTED_PLAN_BAR_LAYOUT_ID}
                className="bg-primary absolute bottom-0 left-0 h-[3px] w-full rounded-full"
              />
            )}
          </motion.button>

          <motion.button
            key="YEARLY"
            className={cn('relative flex items-center gap-x-2.5 px-1 py-2.5 text-[#727272]', {
              'text-slate-900': period === 'YEARLY',
              'hover:text-slate-900/80': period !== 'YEARLY',
            })}
            onClick={() => setPeriod('YEARLY')}
          >
            Yearly
            <div className="block rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
              Save $60
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
          data-plan="self-hosted"
          className="flex flex-col items-center justify-center rounded-lg border bg-white px-8 py-12 shadow-lg shadow-slate-900/5"
        >
          <p className="text-4xl font-medium text-slate-900">Self Hosted</p>
          <p className="text-primary mt-2.5 text-xl font-medium">Free</p>

          <p className="mt-4 max-w-[30ch] text-center text-slate-900">
            For small teams and individuals who need a simple solution
          </p>

          <Link
            href="https://github.com/documenso/documenso"
            target="_blank"
            className="mt-6"
            onClick={() => event('view-github')}
          >
            <Button className="rounded-full text-base">View on Github</Button>
          </Link>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="py-4 font-medium text-slate-900">Host your own instance</p>
            <p className="py-4 text-slate-900">Full Control</p>
            <p className="py-4 text-slate-900">Customizability</p>
            <p className="py-4 text-slate-900">Docker Ready</p>
            <p className="py-4 text-slate-900">Community Support</p>
            <p className="py-4 text-slate-900">Free, Forever</p>
          </div>
        </div>

        <div
          data-plan="community"
          className="border-primary flex flex-col items-center justify-center rounded-lg border-2 bg-white px-8 py-12 shadow-[0px_0px_0px_4px_#E3E3E380] shadow-slate-900/5"
        >
          <p className="text-4xl font-medium text-slate-900">Early Adopters</p>
          <div className="text-primary mt-2.5 text-xl font-medium">
            <AnimatePresence mode="wait">
              {period === 'MONTHLY' && <motion.div layoutId="pricing">$30</motion.div>}
              {period === 'YEARLY' && <motion.div layoutId="pricing">$300</motion.div>}
            </AnimatePresence>
          </div>

          <p className="mt-4 max-w-[30ch] text-center text-slate-900">
            For fast-growing companies that aim to scale across multiple teams.
          </p>

          <ClaimPlanDialog planId={planId}>
            <Button className="mt-6 rounded-full text-base">Signup Now</Button>
          </ClaimPlanDialog>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="py-4 font-medium text-slate-900">
              <a href="https://documens.so/early" target="_blank">
                Documenso Early Adopter Deal
              </a>
            </p>
            <p className="py-4 text-slate-900">Join the movement</p>
            <p className="py-4 text-slate-900">Simple signing solution</p>
            <p className="py-4 text-slate-900">Email and Slack assistance</p>
            <p className="py-4 text-slate-900">
              <strong>
                <a href="https://documens.so/early" target="_blank">
                  Includes all upcoming features
                </a>
              </strong>
            </p>
            <p className="py-4 text-slate-900">Fixed, straightforward pricing</p>
          </div>
        </div>

        <div
          data-plan="enterprise"
          className="flex flex-col items-center justify-center rounded-lg border bg-white px-8 py-12 shadow-lg shadow-slate-900/5"
        >
          <p className="text-4xl font-medium text-slate-900">Enterprise</p>
          <p className="text-primary mt-2.5 text-xl font-medium">Pricing on request</p>

          <p className="mt-4 max-w-[30ch] text-center text-slate-900">
            For large organizations that need extra flexibility and control.
          </p>

          <Link
            href="https://dub.sh/enterprise"
            target="_blank"
            className="mt-6"
            onClick={() => event('enterprise-contact')}
          >
            <Button className="rounded-full text-base">Contact Us</Button>
          </Link>

          <div className="mt-8 flex w-full flex-col divide-y">
            <p className="py-4 font-medium text-slate-900">Everything in Early Adopters, plus:</p>
            <p className="py-4 text-slate-900">Custom Subdomain</p>
            <p className="py-4 text-slate-900">Compliance Check</p>
            <p className="py-4 text-slate-900">Guaranteed Uptime</p>
            <p className="py-4 text-slate-900">Reporting & Analysis</p>
            <p className="py-4 text-slate-900">24/7 Support</p>
          </div>
        </div>
      </div>
    </div>
  );
};
