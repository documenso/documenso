import type { HTMLAttributes } from 'react';

import { cn } from '@documenso/ui/lib/utils';

import { version } from '../../../package.json';

export type AppFooterProps = HTMLAttributes<HTMLDivElement>;

export const AppFooter = ({ className, ...props }: AppFooterProps) => {
  return (
    <footer
      className={cn(
        'text-muted-foreground/70 mt-8 flex items-center justify-center pb-6 text-xs',
        className,
      )}
      {...props}
    >
      <span>v{version}</span>
    </footer>
  );
};
