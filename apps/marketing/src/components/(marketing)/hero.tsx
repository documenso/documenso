'use client';

import { Trans } from '@lingui/macro';
import type { Variants } from 'framer-motion';
import { motion } from 'framer-motion';

import { cn } from '@documenso/ui/lib/utils';

export type HeroProps = {
  className?: string;
  [key: string]: unknown;
};

const HeroTitleVariants: Variants = {
  initial: {
    opacity: 0,
    y: 60,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export const Hero = ({ className, ...props }: HeroProps) => {
  return (
    <motion.div className={cn('relative', className)} {...props}>
      <div className="relative">
        <motion.h2
          variants={HeroTitleVariants}
          initial="initial"
          animate="animate"
          className="text-center text-4xl font-bold leading-tight tracking-tight md:text-[48px] lg:text-[64px]"
        >
          <Trans>
            Document signing,
            <span className="block" />
            finally open source.
          </Trans>
        </motion.h2>
      </div>
    </motion.div>
  );
};
