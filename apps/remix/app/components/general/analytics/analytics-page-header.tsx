import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { cn } from '@documenso/ui/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import type { AnalyticsRangeValue } from '~/utils/analytics';
import { ANALYTICS_RANGE_LABELS, formatAnalyticsDateRange } from '~/utils/analytics';

import { AnalyticsRangePicker } from './analytics-range-picker';

export type AnalyticsPageHeaderProps = {
  avatarImageId: string | null;
  /** The team or organisation name. */
  name: string;
  range: AnalyticsRangeValue;
  onRangeChange: (range: AnalyticsRangeValue) => void;
  /** Rendered before the range picker, e.g. a link to a related analytics page. */
  actions?: ReactNode;
  className?: string;
};

export const AnalyticsPageHeader = ({
  avatarImageId,
  name,
  range,
  onRangeChange,
  actions,
  className,
}: AnalyticsPageHeaderProps) => {
  const { _, i18n } = useLingui();

  const rangeLabel =
    range.range === 'custom'
      ? formatAnalyticsDateRange(range.from, range.to, i18n.locale)
      : _(ANALYTICS_RANGE_LABELS[range.range]);

  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex flex-row items-center">
        <Avatar className="mr-3 h-12 w-12 border-2 border-white border-solid dark:border-border">
          {avatarImageId && <AvatarImage src={formatAvatarUrl(avatarImageId)} />}
          <AvatarFallback className="text-muted-foreground text-xs">{name.slice(0, 1)}</AvatarFallback>
        </Avatar>

        <div>
          <h2 className="font-semibold text-4xl">
            <Trans>Analytics</Trans>
          </h2>

          <p className="mt-1 text-muted-foreground text-sm">
            <Trans>
              Usage overview for {name} · {rangeLabel}
            </Trans>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {actions}

        <AnalyticsRangePicker value={range} onValueChange={onRangeChange} />
      </div>
    </div>
  );
};
