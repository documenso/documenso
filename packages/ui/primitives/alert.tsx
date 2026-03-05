import * as React from 'react';

import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

import { cn } from '../lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg p-4 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-8',
  {
    variants: {
      variant: {
        default:
          'bg-green-50 text-green-700 [&>svg]:text-green-400 [&_.alert-title]:text-green-800',
        neutral:
          'bg-gray-50 text-muted-foreground dark:bg-neutral-900/20 [&_.alert-title]:text-foreground',
        secondary: 'bg-blue-50 text-blue-700 [&>svg]:text-blue-400 [&_.alert-title]:text-blue-800',
        destructive: 'bg-red-50 text-red-700 [&>svg]:text-red-400 [&_.alert-title]:text-red-800',
        warning:
          'bg-yellow-50 text-yellow-700 [&>svg]:text-yellow-400 [&_.alert-title]:text-yellow-800',
      },
      padding: {
        tighter: 'p-2',
        tight: 'px-4 py-2',
        default: 'p-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'default',
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, padding, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn('space-y-2', alertVariants({ variant, padding }), className)}
    {...props}
  />
));

Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('alert-title text-base font-medium', className)} {...props} />
  ),
);

AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm', className)} {...props} />
));

AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
