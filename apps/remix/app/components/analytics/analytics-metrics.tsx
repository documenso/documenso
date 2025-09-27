import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import {
  File,
  FileCheck,
  FileClock,
  FileEdit,
  Mail,
  MailOpen,
  PenTool,
  UserSquare2,
} from 'lucide-react';

import type { DocumentStats, RecipientStats } from '@documenso/lib/server-only/analytics';
import { cn } from '@documenso/ui/lib/utils';

import { CardMetric } from '~/components/general/metric-card';

export type AnalyticsMetricsProps = {
  docStats: DocumentStats;
  recipientStats: RecipientStats;
  isLoading?: boolean;
  className?: string;
};

export const AnalyticsMetrics = ({
  docStats,
  recipientStats,
  isLoading = false,
  className,
}: AnalyticsMetricsProps) => {
  const { _ } = useLingui();

  return (
    <div className={className}>
      {/* Overview Metrics */}
      <div
        className={cn('grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4', {
          'pointer-events-none opacity-50': isLoading,
        })}
      >
        <CardMetric icon={File} title={_(msg`Total Documents`)} value={docStats.ALL} />
        <CardMetric
          icon={FileCheck}
          title={_(msg`Completed Documents`)}
          value={docStats.COMPLETED}
        />
        <CardMetric
          icon={UserSquare2}
          title={_(msg`Total Recipients`)}
          value={recipientStats.TOTAL_RECIPIENTS}
        />
        <CardMetric
          icon={PenTool}
          title={_(msg`Signatures Collected`)}
          value={recipientStats.SIGNED}
        />
      </div>

      {/* Document Metrics Section */}
      <div className="mt-16">
        <h3 className="text-3xl font-semibold">
          <Trans>Document metrics</Trans>
        </h3>

        <div className="mb-8 mt-4 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          <CardMetric icon={FileEdit} title={_(msg`Drafted Documents`)} value={docStats.DRAFT} />
          <CardMetric icon={FileClock} title={_(msg`Pending Documents`)} value={docStats.PENDING} />
          <CardMetric
            icon={FileCheck}
            title={_(msg`Completed Documents`)}
            value={docStats.COMPLETED}
          />
        </div>
      </div>

      {/* Recipients Metrics Section */}
      <div>
        <h3 className="text-3xl font-semibold">
          <Trans>Recipients metrics</Trans>
        </h3>

        <div className="mb-8 mt-4 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          <CardMetric
            icon={UserSquare2}
            title={_(msg`Total Recipients`)}
            value={recipientStats.TOTAL_RECIPIENTS}
          />
          <CardMetric icon={Mail} title={_(msg`Documents Sent`)} value={recipientStats.SENT} />
          <CardMetric
            icon={MailOpen}
            title={_(msg`Documents Viewed`)}
            value={recipientStats.OPENED}
          />
          <CardMetric
            icon={PenTool}
            title={_(msg`Signatures Collected`)}
            value={recipientStats.SIGNED}
          />
        </div>
      </div>
    </div>
  );
};
