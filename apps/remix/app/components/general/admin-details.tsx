import type { ReactNode } from 'react';

import { cn } from '@documenso/ui/lib/utils';

export const formatIsoDate = (value: Date | string | number) => {
  return new Date(value).toISOString().slice(0, 10);
};

export type DetailsCardProps = {
  label: ReactNode;
  action?: ReactNode;
  children: ReactNode;
};

export const DetailsCard = ({ label, action, children }: DetailsCardProps) => {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <span className="text-muted-foreground">{label}</span>
        {action ?? null}
      </div>
      <div className="mt-2 min-h-9">{children}</div>
    </div>
  );
};

export type DetailsValueProps = {
  children: ReactNode;
  isMono?: boolean;
  isSelectable?: boolean;
};

export const DetailsValue = ({
  children,
  isMono = true,
  isSelectable = false,
}: DetailsValueProps) => {
  return (
    <div
      className={cn(
        'flex min-h-10 items-center break-all rounded-md bg-muted px-3 py-2 text-xs',
        isMono && 'font-mono',
        isSelectable && 'select-all',
      )}
    >
      {children}
    </div>
  );
};
