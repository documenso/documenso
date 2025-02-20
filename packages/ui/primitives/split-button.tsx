'use client';

import * as React from 'react';

import { ChevronDown } from 'lucide-react';

import { cn } from '../lib/utils';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

const SplitButtonContext = React.createContext<{
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
}>({});

const SplitButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: React.ComponentProps<typeof Button>['variant'];
    size?: React.ComponentProps<typeof Button>['size'];
  }
>(({ className, children, variant = 'default', size = 'default', ...props }, ref) => {
  return (
    <SplitButtonContext.Provider value={{ variant, size }}>
      <div ref={ref} className={cn('inline-flex', className)} {...props}>
        {children}
      </div>
    </SplitButtonContext.Provider>
  );
});
SplitButton.displayName = 'SplitButton';

const SplitButtonAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { variant, size } = React.useContext(SplitButtonContext);
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn('rounded-r-none border-r-0', className)}
      {...props}
    >
      {children}
    </Button>
  );
});
SplitButtonAction.displayName = 'SplitButtonAction';

const SplitButtonDropdown = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => {
    const { variant, size } = React.useContext(SplitButtonContext);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className="rounded-l-none px-2 focus-visible:ring-offset-0"
          >
            <ChevronDown className="h-4 w-4" />
            <span className="sr-only">More options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" {...props} ref={ref}>
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);
SplitButtonDropdown.displayName = 'SplitButtonDropdown';

const SplitButtonDropdownItem = DropdownMenuItem;

export { SplitButton, SplitButtonAction, SplitButtonDropdown, SplitButtonDropdownItem };
