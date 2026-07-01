import type { TTagLite } from '@documenso/lib/types/tag';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type TagBadgeProps = {
  tag: Pick<TTagLite, 'name'>;
  className?: string;
  children?: ReactNode;
};

export const TagBadge = ({ tag, className, children }: TagBadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 font-medium text-xs ring-1 ring-inset',
        'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20',
        className,
      )}
    >
      {tag.name}
      {children}
    </span>
  );
};
