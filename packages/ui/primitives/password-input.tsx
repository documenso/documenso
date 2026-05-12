import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './button';
import type { InputProps } from './input';
import { Input } from './input';

const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(({ className, ...props }, ref) => {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="relative">
      <Input type={showPassword ? 'text' : 'password'} className={cn('pr-10', className)} ref={ref} {...props} />

      <Button
        variant="link"
        type="button"
        className="absolute top-0 right-0 flex h-full items-center justify-center pr-3"
        aria-label={showPassword ? 'Mask password' : 'Reveal password'}
        onClick={() => setShowPassword((show) => !show)}
      >
        {showPassword ? (
          <EyeOff aria-hidden className="h-5 w-5 text-muted-foreground" />
        ) : (
          <Eye aria-hidden className="h-5 w-5 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
