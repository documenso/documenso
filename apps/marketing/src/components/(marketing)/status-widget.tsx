import { use, useMemo } from 'react';

import type { Status } from '@openstatus/react';
import { getStatus } from '@openstatus/react';

import { cn } from '@documenso/ui/lib/utils';

const getStatusLevel = (level: Status) => {
  return {
    operational: {
      label: 'Operational',
      color: 'bg-green-500',
      color2: 'bg-green-400',
    },
    degraded_performance: {
      label: 'Degraded Performance',
      color: 'bg-yellow-500',
      color2: 'bg-yellow-400',
    },
    partial_outage: {
      label: 'Partial Outage',
      color: 'bg-yellow-500',
      color2: 'bg-yellow-400',
    },
    major_outage: {
      label: 'Major Outage',
      color: 'bg-red-500',
      color2: 'bg-red-400',
    },
    unknown: {
      label: 'Unknown',
      color: 'bg-gray-500',
      color2: 'bg-gray-400',
    },
    incident: {
      label: 'Incident',
      color: 'bg-yellow-500',
      color2: 'bg-yellow-400',
    },
    under_maintenance: {
      label: 'Under Maintenance',
      color: 'bg-gray-500',
      color2: 'bg-gray-400',
    },
  }[level];
};

export function StatusWidget() {
  const getStatusMemoized = useMemo(async () => getStatus('documenso-status'), []);
  const { status } = use(getStatusMemoized);
  const level = getStatusLevel(status);

  return (
    <a
      className="border-border inline-flex max-w-fit  items-center justify-between gap-2 space-x-2 rounded-md border border-gray-200 px-3 py-1 text-sm"
      href="https://status.documenso.com"
      target="_blank"
      rel="noreferrer"
    >
      <div>
        <p className="text-sm">{level.label}</p>
      </div>

      <span className="relative ml-auto flex h-1.5 w-1.5">
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            level.color2,
          )}
        />
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', level.color)} />
      </span>
    </a>
  );
}
