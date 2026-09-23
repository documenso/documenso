import { Card, CardContent } from '@documenso/ui/primitives/card';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { AnalyticsQueryError } from './analytics-query-error';

export type AnalyticsStatCardProps = {
  icon: LucideIcon;
  title: ReactNode;
  value: ReactNode;
  description: ReactNode;
  badge?: ReactNode;
  isPending: boolean;
  isError: boolean;
  isRefetching?: boolean;
  onRetry: () => void;
  testId: string;
};

export const AnalyticsStatCard = ({
  icon: Icon,
  title,
  value,
  description,
  badge,
  isPending,
  isError,
  isRefetching = false,
  onRetry,
  testId,
}: AnalyticsStatCardProps) => {
  return (
    <Card>
      <CardContent className="flex flex-col p-5">
        <div className="flex items-center justify-between gap-x-3">
          <h3 className="font-medium text-muted-foreground text-sm">{title}</h3>

          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>

        {isError ? (
          <AnalyticsQueryError onRetry={onRetry} isRetrying={isRefetching} className="mt-3" />
        ) : isPending ? (
          <div className="mt-3 flex flex-col gap-y-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="font-semibold text-3xl text-foreground tabular-nums tracking-tight" data-testid={testId}>
                {value}
              </p>

              {badge}
            </div>

            <p className="mt-1 text-muted-foreground text-xs">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};
