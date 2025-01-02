import React from 'react';

import { cn } from '@documenso/ui/lib/utils';

export type SettingsHeaderProps = {
  title: string | React.ReactNode;
  subtitle: string | React.ReactNode;
  hideDivider?: boolean;
  children?: React.ReactNode;
  className?: string;
};

export const SettingsHeader = ({
  children,
  title,
  subtitle,
  className,
  hideDivider,
}: SettingsHeaderProps) => {
  return (
    <>
      <div className={cn('flex flex-row items-center justify-between', className)}>
        <div>
          <h3 className="text-lg font-medium">{title}</h3>

          <p className="text-muted-foreground text-sm md:mt-2">{subtitle}</p>
        </div>

        {children}
      </div>

      {!hideDivider && <hr className="my-4" />}
    </>
  );
};
