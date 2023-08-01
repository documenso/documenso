import { HTMLAttributes } from 'react';

import { cn } from '@documenso/ui/lib/utils';

export type MetricCardProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  value: string;
};

export const MetricCard = ({ className, title, value, ...props }: MetricCardProps) => {
  return (
    <div className={cn('rounded-md border p-4 shadow-sm hover:shadow', className)} {...props}>
      <h4 className="text-muted-foreground text-sm font-medium">{title}</h4>

      <p className="mb-2 mt-6 text-4xl font-bold">{value}</p>
    </div>
  );
};
