import * as React from 'react';

import { cn } from '../lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /**
   * Optional function that returns the border class(es) to apply (e.g. "border-amber-400").
   * Called on each render so the border can change based on external variables.
   */
  getBorderClassName?: () => string;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, getBorderClassName, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'bg-background border-input ring-offset-background placeholder:text-muted-foreground/40 focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          getBorderClassName?.(),
          className,
          {
            'ring-2 !ring-red-500 transition-all': props['aria-invalid'],
          },
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

export { Input };
