import * as React from 'react';

import { cva } from 'class-variance-authority';
import { Loader } from 'lucide-react';

import { cn } from '../lib/utils';

const spinnerVariants = cva('text-muted-foreground animate-spin', {
  variants: {
    size: {
      default: 'h-6 w-6',
      sm: 'h-4 w-4',
      lg: 'h-8 w-8',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

type SpinnerSize = 'default' | 'sm' | 'lg';

export interface SpinnerProps extends Omit<React.ComponentPropsWithoutRef<typeof Loader>, 'size'> {
  size?: SpinnerSize;
}

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, size = 'default', ...props }, ref) => {
    return <Loader ref={ref} className={cn(spinnerVariants({ size }), className)} {...props} />;
  },
);

Spinner.displayName = 'Spinner';

export interface SpinnerBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  spinnerProps?: SpinnerProps;
}

const SpinnerBox = React.forwardRef<HTMLDivElement, SpinnerBoxProps>(
  ({ className, spinnerProps, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-center rounded-lg', className)}
        {...props}
      >
        <Spinner {...spinnerProps} />
      </div>
    );
  },
);

SpinnerBox.displayName = 'SpinnerBox';

export { Spinner, SpinnerBox, spinnerVariants };
