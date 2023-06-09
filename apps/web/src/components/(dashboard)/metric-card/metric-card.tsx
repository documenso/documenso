import React from 'react';

import { LucideIcon } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';

export type CardMetricProps = {
  icon?: LucideIcon;
  title: string;
  value: string | number;
  className?: string;
};

export const CardMetric = ({ icon: Icon, title, value, className }: CardMetricProps) => {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-slate-200 bg-white')}>
      <div className="px-4 pb-6 pt-4 sm:px-4 sm:pb-8 sm:pt-4">
        <div className="flex items-start">
          {Icon && <Icon className="mr-2 h-4 w-4 text-slate-500" />}

          <h3 className="flex items-end text-sm font-medium text-slate-500">{title}</h3>
        </div>

        <p className="mt-6 text-4xl font-semibold leading-8 text-gray-900 md:mt-8">
          {typeof value === 'number' ? value.toLocaleString('en-US') : value}
        </p>
      </div>
    </div>
  );
};
