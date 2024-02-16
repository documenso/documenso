'use client';

import * as React from 'react';

import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '../lib/utils';

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
));

Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    {...props}
  />
));

AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'bg-muted flex h-full w-full items-center justify-center rounded-full',
      className,
    )}
    {...props}
  />
));

AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

type AvatarWithTextProps = {
  avatarClass?: string;
  avatarFallback: string;
  className?: string;
  primaryText: React.ReactNode;
  secondaryText?: React.ReactNode;
  rightSideComponent?: React.ReactNode;
};

const AvatarWithText = ({
  avatarClass,
  avatarFallback,
  className,
  primaryText,
  secondaryText,
  rightSideComponent,
}: AvatarWithTextProps) => (
  <div className={cn('flex w-full max-w-xs items-center gap-2', className)}>
    <Avatar
      className={cn('dark:border-border h-10 w-10 border-2 border-solid border-white', avatarClass)}
    >
      <AvatarFallback className="text-xs text-gray-400">{avatarFallback}</AvatarFallback>
    </Avatar>

    <div className="flex flex-col text-left text-sm font-normal">
      <span className="text-foreground truncate">{primaryText}</span>
      <span className="text-muted-foreground truncate text-xs">{secondaryText}</span>
    </div>

    {rightSideComponent}
  </div>
);

export { Avatar, AvatarImage, AvatarFallback, AvatarWithText };
