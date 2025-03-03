import * as React from 'react';

import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md text-xs font-medium ring-1 ring-inset w-fit',
  {
    variants: {
      variant: {
        neutral:
          'bg-grey-100 text-grey-600 ring-grey-500/10 dark:bg-grey-400/10 dark:text-grey-400 dark:ring-grey-400/20',
        destructive:
          'bg-destructive-lighter text-destructive-dark ring-destructive/10 dark:bg-destructive-lighter/10 dark:text-destructive-light dark:ring-destructive/20',
        warning:
          'bg-warning-lighter text-warning-dark ring-warning/20 dark:bg-warning-lighter/10 dark:text-warning-light dark:ring-warning/20',
        default:
          'bg-primary-lighter text-primary-dark ring-primary/20 dark:bg-primary-lighter/10 dark:text-primary-light dark:ring-primary/20',
        secondary:
          'bg-secondary-lighter text-secondary-dark ring-secondary/10 dark:bg-secondary-lighter/10 dark:text-secondary-light dark:ring-secondary/30',
        info: 'bg-info-lighter text-info-dark ring-info/10 dark:bg-info-lighter/10 dark:text-info-light dark:ring-info/30',
        success:
          'bg-success-lighter text-success-dark ring-success/10 dark:bg-success-lighter/10 dark:text-success-light dark:ring-success/30',
      },
      size: {
        small: 'px-1.5 py-0.5 text-xs',
        default: 'px-2 py-1.5 text-xs',
        large: 'px-3 py-2 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
