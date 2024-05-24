// https://github.com/documenso/documenso/pull/1044/files#r1538258462
import { Suspense } from 'react';

import { StatusWidget } from './status-widget';

export function StatusWidgetContainer() {
  return (
    <Suspense fallback={<StatusWidgetFallback />}>
      <StatusWidget slug="documenso-status" />
    </Suspense>
  );
}

function StatusWidgetFallback() {
  return (
    <div className="border-border inline-flex max-w-fit  items-center justify-between space-x-2 rounded-md border border-gray-200 px-2 py-2 pr-3 text-sm">
      <span className="bg-muted h-2 w-36 animate-pulse rounded-md" />
      <span className="bg-muted relative inline-flex h-2 w-2 rounded-full" />
    </div>
  );
}
