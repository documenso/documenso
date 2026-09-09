import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { SIGNATURE_CANVAS_DPI } from '@documenso/lib/constants/signatures';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import type { TQrSignatureContext } from '@documenso/lib/types/qr-signature';
import { trpc } from '@documenso/trpc/react';

import { Trans, useLingui } from '@lingui/react/macro';
import { Loader2Icon, RefreshCwIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { renderSVG } from 'uqr';

import { cn } from '../../lib/utils';
import { Button } from '../button';
import { SignatureRender } from './signature-render';

export type QrSignatureSession = {
  token: string;
  expiresAt: Date;
};

/**
 * Redraw a signature onto a canvas of the given size, scaled to fit and
 * centered.
 *
 * The phone pad's canvas has different dimensions to the local draw pad, and
 * the draw pad renders its value at natural size without scaling - committing
 * the phone's PNG directly would make it render smaller (or larger) than the
 * preview. Normalising to the local pad's dimensions keeps every consumer of
 * the value untouched.
 */
const normalizeSignatureSize = async (dataUrl: string, targetWidth: number, targetHeight: number): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const scale = Math.min(targetWidth / img.width, targetHeight / img.height);

      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;

      ctx.drawImage(img, (targetWidth - scaledWidth) / 2, (targetHeight - scaledHeight) / 2, scaledWidth, scaledHeight);

      resolve(canvas.toDataURL());
    };

    img.onerror = () => resolve(dataUrl);

    img.src = dataUrl;
  });

export type SignaturePadQrProps = {
  className?: string;
  value: string;
  onChange: (_signatureDataUrl: string) => void;
  session: QrSignatureSession | null;
  onSessionChange: (_session: QrSignatureSession | null) => void;

  /**
   * What the handoff signature is for. Rendered on the mobile signing page so
   * the signer can see the context of what they are signing. When omitted the
   * mobile page shows a generic "Signature requested".
   */
  context?: TQrSignatureContext;
};

/**
 * The "Mobile" tab of the signature pad.
 *
 * Displays a QR code linking to a public mobile drawing page, then polls until
 * the phone submits a signature. The received signature is committed as a
 * drawn (base64 PNG) signature via `onChange`.
 *
 * The session lives in the parent so that switching tabs does not invalidate
 * an in-flight handoff (tab contents unmount when inactive).
 */
export const SignaturePadQr = ({
  className,
  value,
  onChange,
  session,
  onSessionChange,
  context,
}: SignaturePadQrProps) => {
  const { t } = useLingui();

  const hasFiredCreateRef = useRef(false);
  const $container = useRef<HTMLDivElement>(null);

  // Only show the preview for a signature received during this mount - a value
  // drawn on another tab renders the QR code so the handoff stays available
  // without destroying the committed signature.
  const [hasReceivedSignature, setHasReceivedSignature] = useState(false);

  const { mutate: createQrSignatureSession, isError: isCreateSessionError } = trpc.signature.qr.create.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (data) => {
      onSessionChange(data);
    },
  });

  const { data: qrSignatureData } = trpc.signature.qr.get.useQuery(
    {
      token: session?.token ?? '',
    },
    {
      enabled: Boolean(session),
      refetchInterval: (query) =>
        query.state.data?.status === 'COMPLETED' || query.state.data?.status === 'EXPIRED' ? false : 2500,
    },
  );

  useEffect(() => {
    if (!session && !hasFiredCreateRef.current) {
      hasFiredCreateRef.current = true;
      createQrSignatureSession({ context });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (qrSignatureData?.status !== 'COMPLETED') {
      return;
    }

    // The tab container has the same box as the draw tab, so its measured size
    // matches the draw pad's canvas dimensions.
    const container = $container.current;

    const targetWidth = container ? Math.round(container.clientWidth * SIGNATURE_CANVAS_DPI) : 0;
    const targetHeight = container ? Math.round(container.clientHeight * SIGNATURE_CANVAS_DPI) : 0;

    if (targetWidth <= 0 || targetHeight <= 0) {
      onChange(qrSignatureData.signature);
      onSessionChange(null);
      setHasReceivedSignature(true);
      return;
    }

    let isCancelled = false;

    void normalizeSignatureSize(qrSignatureData.signature, targetWidth, targetHeight).then((normalizedSignature) => {
      if (!isCancelled) {
        onChange(normalizedSignature);
        onSessionChange(null);
        setHasReceivedSignature(true);
      }
    });

    return () => {
      isCancelled = true;
    };
    // Note: `onChange`/`onSessionChange` are fresh closures from the parent each
    // render, so including them would re-fire this effect spuriously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrSignatureData]);

  const onGenerateNewCodeClick = () => {
    onSessionChange(null);
    createQrSignatureSession({ context });
  };

  const onScanAgainClick = () => {
    setHasReceivedSignature(false);
    onSessionChange(null);
    createQrSignatureSession({ context });
  };

  // Only a signature received via this tab shows the preview; any other
  // value keeps the QR available.
  if (value && hasReceivedSignature) {
    return (
      <div
        data-testid="signature-pad-qr-preview"
        className={cn('relative flex h-full w-full flex-col items-center justify-center', className)}
      >
        <SignatureRender value={value} className="h-full w-full" />

        <div className="absolute right-3 bottom-3">
          <button
            type="button"
            className="flex items-center gap-1 rounded-full p-0 text-[0.688rem] text-muted-foreground/60 ring-offset-background hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onScanAgainClick()}
          >
            <RefreshCwIcon className="size-3" />
            <Trans>Scan again</Trans>
          </button>
        </div>
      </div>
    );
  }

  if (isCreateSessionError || qrSignatureData?.status === 'EXPIRED') {
    return (
      <div className={cn('flex h-full w-full flex-col items-center justify-center gap-2', className)}>
        <p className="text-muted-foreground text-sm">
          {isCreateSessionError ? (
            <Trans>Something went wrong. Please try again.</Trans>
          ) : (
            <Trans>This QR code has expired.</Trans>
          )}
        </p>

        <Button type="button" variant="outline" size="sm" onClick={() => onGenerateNewCodeClick()}>
          <RefreshCwIcon className="mr-2 size-4" />
          <Trans>Generate new code</Trans>
        </Button>
      </div>
    );
  }

  // Session is being created (or is about to be) - show the loader. This must
  // never depend on the mutation's isPending, which can be stale after a
  // StrictMode double-mount.
  if (!session) {
    return (
      <div role="status" className={cn('flex h-full w-full items-center justify-center', className)}>
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        <span className="sr-only">
          <Trans>Loading</Trans>
        </span>
      </div>
    );
  }

  const mobileSigningUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/mobile-signature/${session.token}`;

  return (
    <div
      ref={$container}
      data-testid="signature-pad-qr"
      className={cn(
        'flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 overflow-hidden p-3',
        className,
      )}
    >
      {/* The QR absorbs whatever vertical space is left over, so the labels
          below always keep their room and can never be pushed out of the pad. */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          role="img"
          aria-label={t`QR code for mobile signing`}
          className="aspect-square h-full rounded-md bg-white p-1.5 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Expected usage to render QR.
          dangerouslySetInnerHTML={{
            __html: renderSVG(mobileSigningUrl),
          }}
        />
      </div>

      <p className="shrink-0 text-muted-foreground text-xs">
        <Trans>Scan with your phone to draw your signature</Trans>
      </p>

      <p
        data-testid="signature-pad-qr-url"
        className="w-full shrink-0 truncate px-2 text-center text-[0.688rem] text-muted-foreground/60"
      >
        {mobileSigningUrl}
      </p>
    </div>
  );
};
