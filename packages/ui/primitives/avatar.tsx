import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as React from 'react';

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
  <AvatarPrimitive.Image ref={ref} className={cn('aspect-square h-full w-full', className)} {...props} />
));

AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn('flex h-full w-full items-center justify-center rounded-full bg-muted', className)}
    {...props}
  />
));

AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

type AvatarWithTextProps = {
  avatarClass?: string;
  avatarSrc?: string | null;
  avatarFallback: string;
  className?: string;
  primaryText: React.ReactNode;
  secondaryText?: React.ReactNode;
  rightSideComponent?: React.ReactNode;
  // Optional class to hide/show the text beside avatar
  textSectionClassName?: string;
};

const AvatarWithText = ({
  avatarClass,
  avatarSrc,
  avatarFallback,
  className,
  primaryText,
  secondaryText,
  rightSideComponent,
  textSectionClassName,
}: AvatarWithTextProps) => (
  <div className={cn('flex w-full max-w-xs items-center gap-2', className)}>
    <Avatar className={cn('h-10 w-10 border-2 border-white border-solid dark:border-border', avatarClass)}>
      {avatarSrc && <AvatarImage src={avatarSrc} />}
      <AvatarFallback className="text-gray-400 text-xs">{avatarFallback}</AvatarFallback>
    </Avatar>

    <div className={cn('flex flex-col truncate text-left font-normal text-sm', textSectionClassName)}>
      <span className="truncate text-foreground">{primaryText}</span>
      <span className="truncate text-muted-foreground text-xs">{secondaryText}</span>
    </div>

    {rightSideComponent}
  </div>
);

export { Avatar, AvatarFallback, AvatarImage, AvatarWithText };
