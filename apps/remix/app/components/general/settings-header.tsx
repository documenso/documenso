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
      <div className={cn('mb-4 flex flex-row items-center justify-between', className)}>
        <div>
          <h2 className="font-bold text-xl">{title}</h2>

          <p className="text-muted-foreground text-sm md:mt-2">{subtitle}</p>
        </div>

        {children}
      </div>

      {!hideDivider && <hr className="mb-4" />}
    </>
  );
};
