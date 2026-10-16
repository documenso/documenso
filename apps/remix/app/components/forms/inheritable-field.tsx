import { cn } from '@documenso/ui/lib/utils';
import { FormItem, FormLabel } from '@documenso/ui/primitives/form/form';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type InheritableFieldProps = {
  isInherited: boolean;
  canInherit: boolean;
  label: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
};

export const InheritableField = ({
  isInherited,
  canInherit,
  label,
  children,
  className,
  testId,
}: InheritableFieldProps) => {
  if (!canInherit) {
    return (
      <FormItem className={className}>
        <FormLabel>{label}</FormLabel>
        {children}
      </FormItem>
    );
  }

  return (
    <FormItem className={className} data-testid={testId ? `inheritable-${testId}` : undefined}>
      <FormLabel className="flex items-center gap-2">
        {label}
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-bold text-[9px] uppercase tracking-wide',
            isInherited
              ? 'bg-muted text-muted-foreground'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
          )}
          data-testid={testId ? `${testId}-status` : undefined}
        >
          {isInherited ? <Trans>Inherited</Trans> : <Trans>Override</Trans>}
        </span>
      </FormLabel>
      {children}
    </FormItem>
  );
};
