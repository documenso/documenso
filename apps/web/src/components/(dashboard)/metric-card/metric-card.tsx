import type { LucideIcon } from 'lucide-react/dist/lucide-react';

import { cn } from '@documenso/ui/lib/utils';

export type CardMetricProps = {
  icon?: LucideIcon;
  title: string;
  value: string | number;
  className?: string;
};

export const CardMetric = ({ icon: Icon, title, value, className }: CardMetricProps) => {
  return (
    <div
      className={cn(
        'border-border bg-background hover:shadow-border/80 overflow-hidden rounded-lg border shadow shadow-transparent duration-200',
        className,
      )}
    >
      <div className="px-4 pb-6 pt-4 sm:px-4 sm:pb-8 sm:pt-4">
        <div className="flex items-start">
          {Icon && <Icon className="mr-2 h-4 w-4 text-slate-500" />}

          <h3 className="flex items-end text-sm font-medium text-slate-500">{title}</h3>
        </div>

        <p className="text-foreground mt-6 text-4xl font-semibold leading-8 md:mt-8">
          {typeof value === 'number' ? value.toLocaleString('en-US') : value}
        </p>
      </div>
    </div>
  );
};
