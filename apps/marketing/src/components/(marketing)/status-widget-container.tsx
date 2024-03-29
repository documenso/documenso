// https://github.com/documenso/documenso/pull/1044/files#r1538258462
import { Suspense, use } from 'react';

import { getStatus } from '@openstatus/react';

import { StatusWidget } from './status-widget';

export function StatusWidgetContainer() {
  const res = use(getStatus('documenso'));

  return (
    <Suspense fallback={<StatusWidgetFallback />}>
      <StatusWidget status={res.status} />
    </Suspense>
  );
}

function StatusWidgetFallback() {
  return (
    <div className="border-border flex max-w-fit items-center gap-2 rounded-md border px-3 py-1 text-sm">
      <span className="bg-muted h-5 w-20 animate-pulse rounded-md" />
      <span className="bg-muted relative inline-flex h-2 w-2 rounded-full" />
    </div>
  );
}
