import * as React from 'react';

<<<<<<< HEAD
import { VariantProps, cva } from 'class-variance-authority';
=======
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
>>>>>>> main

import { cn } from '../lib/utils';

const badgeVariants = cva(
<<<<<<< HEAD
  'inline-flex items-center border rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary hover:bg-primary/80 border-transparent text-primary-foreground',
        secondary:
          'bg-secondary hover:bg-secondary/80 border-transparent text-secondary-foreground',
        destructive:
          'bg-destructive hover:bg-destructive/80 border-transparent text-destructive-foreground',
        outline: 'text-foreground',
=======
  'inline-flex items-center rounded-md text-xs font-medium ring-1 ring-inset w-fit',
  {
    variants: {
      variant: {
        neutral:
          'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20',
        destructive:
          'bg-red-50 text-red-700 ring-red-600/10 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20',
        warning:
          'bg-yellow-50 text-yellow-800 ring-yellow-600/20 dark:bg-yellow-400/10 dark:text-yellow-500 dark:ring-yellow-400/20',
        default:
          'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20',
        secondary:
          'bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30',
      },
      size: {
        small: 'px-1.5 py-0.5 text-xs',
        default: 'px-2 py-1.5 text-xs',
        large: 'px-3 py-2 text-sm',
>>>>>>> main
      },
    },
    defaultVariants: {
      variant: 'default',
<<<<<<< HEAD
=======
      size: 'default',
>>>>>>> main
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

<<<<<<< HEAD
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
=======
function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
>>>>>>> main
}

export { Badge, badgeVariants };
