import * as React from 'react';

import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

import { cn } from '../lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg p-4 [&>svg]:absolute [&>svg]:text-foreground [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:translate-y-[-3px] [&>svg~*]:pl-8',
  {
    variants: {
      variant: {
        default:
          'bg-primary-lighter text-primary-darker [&_.alert-title]:text-primary-dark [&>svg]:text-primary',
        neutral:
          'bg-gray-50 dark:bg-neutral-900/20 text-muted-foreground [&_.alert-title]:text-foreground',
        secondary:
          'bg-secondary-lighter text-secondary-darker [&_.alert-title]:text-secondary-dark [&>svg]:text-secondary',
        destructive:
          'bg-destructive-lighter text-destructive-darker [&_.alert-title]:text-destructive-dark [&>svg]:text-destructive',
        warning:
          'bg-warning-lighter text-warning-darker [&_.alert-title]:text-warning-dark [&>svg]:text-warning',
        info: 'bg-info-lighter text-info-darker [&_.alert-title]:text-info-dark [&>svg]:text-info',
        success:
          'bg-success-lighter text-success-darker [&_.alert-title]:text-success-dark [&>svg]:text-success',
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
    className={cn(alertVariants({ variant, padding }), className)}
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
