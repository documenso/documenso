/**
 * Wrapped like pdf-viewer-lazy.tsx: lazy so the pdfjs worker is not bundled, and rendered on the client only.
 * Any error inside the easy-read view switches the signer to the original pages instead of breaking signing.
 */
import { Trans } from '@lingui/react/macro';
import { Loader2 } from 'lucide-react';
import { Component, lazy, type ReactNode, Suspense, useEffect, useState } from 'react';

import type { ReflowDocumentProps } from './reflow-document';

const ReflowDocument = lazy(async () => import('./reflow-document'));

export default function ReflowDocumentLazy(props: ReflowDocumentProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fallback = (
    <div className="flex w-full max-w-[680px] items-center justify-center rounded-lg border bg-white py-24 text-neutral-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      <Trans>Loading document…</Trans>
    </div>
  );

  if (!isClient) {
    return fallback;
  }

  return (
    <FallBackToOriginal onError={props.onShowOriginal}>
      <Suspense fallback={fallback}>
        <ReflowDocument {...props} />
      </Suspense>
    </FallBackToOriginal>
  );
}

// React only supports error boundaries as class components.
class FallBackToOriginal extends Component<{ onError: () => void; children: ReactNode }, { hasFailed: boolean }> {
  state = { hasFailed: false };

  static getDerivedStateFromError() {
    return { hasFailed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[reflow] easy-read view failed, showing the original pages:', error);
    this.props.onError();
  }

  render() {
    return this.state.hasFailed ? null : this.props.children;
  }
}
