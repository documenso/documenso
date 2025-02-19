// Todo: (RR7) Not sure if this actually makes it client-only.
import { Suspense, lazy } from 'react';

import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { Await } from 'react-router';

const LoadingComponent = () => (
  <div className="dark:bg-background flex h-[80vh] max-h-[60rem] flex-col items-center justify-center bg-white/50">
    <Loader className="text-documenso h-12 w-12 animate-spin" />
    <p className="text-muted-foreground mt-4">
      <Trans>Loading document...</Trans>
    </p>
  </div>
);

export const LazyPDFViewerImport = lazy(async () => import('./pdf-viewer'));

export const LazyPDFViewer = (props: React.ComponentProps<typeof LazyPDFViewerImport>) => (
  <Suspense fallback={<LoadingComponent />}>
    <Await resolve={LazyPDFViewerImport}>
      <LazyPDFViewerImport {...props} />
    </Await>
  </Suspense>
);

export const LazyPDFViewerNoLoader = (props: React.ComponentProps<typeof LazyPDFViewer>) => (
  <Suspense fallback={null}>
    <LazyPDFViewerImport {...props} />
  </Suspense>
);
