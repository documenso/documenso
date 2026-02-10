import type { LucideIcon } from 'lucide-react/dist/lucide-react';

import { cn } from '@documenso/ui/lib/utils';

export type CardMetricProps = {
  icon?: LucideIcon;
  title: string;
  value?: string | number;
  className?: string;
  children?: React.ReactNode;
};

export const CardMetric = ({ icon: Icon, title, value, className, children }: CardMetricProps) => {
  return (
    <div
      className={cn(
        'h-32 max-h-32 max-w-full overflow-hidden rounded-lg border border-border bg-background shadow shadow-transparent duration-200 hover:shadow-border/80',
        className,
      )}
    >
      <div className="flex h-full max-h-full flex-col px-4 pb-6 pt-4 sm:px-4 sm:pb-8 sm:pt-4">
        <div className="flex items-start">
          {Icon && (
            <div className="mr-2 h-4 w-4">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          <h3 className="text-primary-forground mb-2 flex items-end text-sm font-medium leading-tight">
            {title}
          </h3>
        </div>

        {children || (
          <p className="mt-auto text-4xl font-semibold leading-8 text-foreground">
            {typeof value === 'number' ? value.toLocaleString('en-US') : value}
          </p>
        )}
      </div>
    </div>
  );
};
