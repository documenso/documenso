import * as React from 'react';

import { Eye, EyeOff } from 'lucide-react';

import { cn } from '../lib/utils';
import { Button } from './button';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'border-input ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
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

const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className="relative">
        <Input
          id="password"
          type={showPassword ? 'text' : 'password'}
          className={cn('pr-10', className)}
          ref={ref}
          {...props}
        />

        <Button
          variant="link"
          type="button"
          className="absolute right-0 top-0 flex h-full items-center justify-center pr-3"
          aria-label={showPassword ? 'Mask password' : 'Reveal password'}
          onClick={() => setShowPassword((show) => !show)}
        >
          {showPassword ? (
            <EyeOff aria-hidden className="text-muted-foreground h-5 w-5" />
          ) : (
            <Eye aria-hidden className="text-muted-foreground h-5 w-5" />
          )}
        </Button>
      </div>
    );
  },
);

PasswordInput.displayName = 'Input';

export { Input, PasswordInput };
