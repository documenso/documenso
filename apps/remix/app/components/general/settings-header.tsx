import { cn } from '@documenso/ui/lib/utils';
import type React from 'react';

export type SettingsHeaderProps = {
  title: string | React.ReactNode;

  /**
   * Shown beside the title, e.g. a status. Kept outside the heading so it isn't part of its
   * accessible name.
   */
  badge?: React.ReactNode;
  subtitle: string | React.ReactNode;
  hideDivider?: boolean;
  children?: React.ReactNode;
  className?: string;
};

export const SettingsHeader = ({ children, title, badge, subtitle, className, hideDivider }: SettingsHeaderProps) => {
  const heading = (
    <h2 className="min-w-0 font-bold text-xl leading-tight [overflow-wrap:anywhere] [text-wrap:balance]">{title}</h2>
  );

  return (
    <>
      <div
        className={cn('mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center', className)}
      >
        <div className="min-w-0">
          {badge ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {heading}
              {badge}
            </div>
          ) : (
            heading
          )}

          <p className="mt-1 max-w-[65ch] text-muted-foreground text-sm leading-normal [overflow-wrap:break-word] [text-wrap:pretty] md:mt-2">
            {subtitle}
          </p>
        </div>

        {children}
      </div>

      {!hideDivider && <hr className="mb-4" />}
    </>
  );
};
