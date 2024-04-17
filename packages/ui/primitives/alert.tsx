import * as React from 'react';

<<<<<<< HEAD
import { VariantProps, cva } from 'class-variance-authority';
=======
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
>>>>>>> main

import { cn } from '../lib/utils';

const alertVariants = cva(
<<<<<<< HEAD
  'relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:text-foreground [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-11',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'text-destructive border-destructive/50 dark:border-destructive [&>svg]:text-destructive text-destructive',
=======
  'relative w-full rounded-lg p-4 [&>svg]:absolute [&>svg]:text-foreground [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:translate-y-[-3px] [&>svg~*]:pl-8',
  {
    variants: {
      variant: {
        default:
          'bg-green-50 text-green-700 [&_.alert-title]:text-green-800 [&>svg]:text-green-400',
        neutral:
          'bg-gray-50 dark:bg-neutral-900/20 text-muted-foreground [&_.alert-title]:text-foreground',
        secondary: 'bg-blue-50 text-blue-700 [&_.alert-title]:text-blue-800 [&>svg]:text-blue-400',
        destructive: 'bg-red-50 text-red-700 [&_.alert-title]:text-red-800 [&>svg]:text-red-400',
        warning:
          'bg-yellow-50 text-yellow-700 [&_.alert-title]:text-yellow-800 [&>svg]:text-yellow-400',
      },
      padding: {
        tighter: 'p-2',
        tight: 'px-4 py-2',
        default: 'p-4',
>>>>>>> main
      },
    },
    defaultVariants: {
      variant: 'default',
<<<<<<< HEAD
=======
      padding: 'default',
>>>>>>> main
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
<<<<<<< HEAD
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
=======
>(({ className, variant, padding, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant, padding }), className)}
    {...props}
  />
>>>>>>> main
));

Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
<<<<<<< HEAD
    <h5
      ref={ref}
      className={cn('mb-1 font-medium leading-none tracking-tight', className)}
      {...props}
    />
=======
    <h5 ref={ref} className={cn('alert-title text-base font-medium', className)} {...props} />
>>>>>>> main
  ),
);

AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
<<<<<<< HEAD
  <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
=======
  <div ref={ref} className={cn('text-sm', className)} {...props} />
>>>>>>> main
));

AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
