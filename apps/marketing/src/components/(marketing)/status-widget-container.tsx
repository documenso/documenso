// https://github.com/documenso/documenso/pull/1044/files#r1538258462
import { Suspense } from 'react';

import { StatusWidget } from './status-widget';

export function StatusWidgetContainer() {
  return (
    <Suspense fallback={<StatusWidgetFallback />}>
      <StatusWidget />
    </Suspense>
  );
}

function StatusWidgetFallback() {
  return (
    <a
      className="border-border inline-flex max-w-fit  items-center justify-between gap-2 space-x-2 rounded-md border border-gray-200 px-3 py-1 text-sm"
      href="https://status.documenso.com"
      target="_blank"
      rel="noreferrer"
    >
      <div>
        <p className="text-sm">Operational</p>
      </div>

      <span className="relative ml-auto flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
      </span>
    </a>
  );
}
