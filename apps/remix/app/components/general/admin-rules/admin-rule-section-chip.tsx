import { cn } from '@documenso/ui/lib/utils';
import type { ReactNode } from 'react';

export type AdminRuleSectionChipProps = {
  variant: 'dark' | 'primary' | 'muted';
  children: ReactNode;
};

/**
 * The small uppercase WHEN / EXCEPT / IF / THEN label that opens each section of the rule editor.
 */
export const AdminRuleSectionChip = ({ variant, children }: AdminRuleSectionChipProps) => {
  return (
    <span
      className={cn(
        'inline-flex h-[26px] min-w-[52px] shrink-0 items-center justify-center rounded-md px-2.5 font-bold text-xs uppercase tracking-[0.06em]',
        {
          'bg-foreground text-background': variant === 'dark',
          'bg-primary text-primary-foreground': variant === 'primary',
          'bg-muted text-foreground ring-1 ring-border ring-inset': variant === 'muted',
        },
      )}
    >
      {children}
    </span>
  );
};
