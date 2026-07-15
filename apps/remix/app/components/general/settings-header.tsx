import { cn } from '@documenso/ui/lib/utils';
import type React from 'react';

export type SettingsHeaderProps = {
  title: string | React.ReactNode;
  subtitle: string | React.ReactNode;
  hideDivider?: boolean;
  children?: React.ReactNode;
  className?: string;
};

export const SettingsHeader = ({ children, title, subtitle, className, hideDivider }: SettingsHeaderProps) => {
  return (
    <>
      <div className={cn('flex flex-row items-center justify-between', className)}>
        <div className="min-w-0">
          <h3 className="font-medium text-lg leading-tight [text-wrap:balance]">{title}</h3>

          <p className="mt-1 max-w-[65ch] text-muted-foreground text-sm leading-normal [overflow-wrap:break-word] [text-wrap:pretty] md:mt-2">
            {subtitle}
          </p>
        </div>

        {children}
      </div>

      {!hideDivider && <hr className="my-4" />}
    </>
  );
};
