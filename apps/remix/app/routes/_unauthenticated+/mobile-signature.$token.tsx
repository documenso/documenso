import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import type {
  TGetQrSignatureSessionResponse,
  TQrSignatureSessionContext,
} from '@documenso/trpc/server/signature-router/qr/get-qr-signature-session.types';
import { Button } from '@documenso/ui/primitives/button';
import { Sheet, SheetContent, SheetTitle } from '@documenso/ui/primitives/sheet';
import { SignaturePadDraw } from '@documenso/ui/primitives/signature-pad/signature-pad-draw';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { CheckCircle2Icon, ClockIcon, FileTextIcon, Loader2Icon, PenLineIcon, XCircleIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { match } from 'ts-pattern';

import type { Route } from './+types/mobile-signature.$token';

export function meta() {
  return [
    { title: i18n._(msg`Sign on mobile - Documenso`) },
    { name: 'robots', content: 'noindex, nofollow, noarchive, nosnippet, noimageindex' },
  ];
}

export default function MobileSignaturePage({ params }: Route.ComponentProps) {
  const { token } = params;

  const {
    data: session,
    isError: isSessionError,
    isLoading: isSessionLoading,
  } = trpc.signature.qr.getSession.useQuery(
    {
      token,
    },
    {
      // Do not refetch the session.
      staleTime: Number.POSITIVE_INFINITY,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    },
  );

  if (isSessionLoading || !session) {
    return (
      <div className="flex w-full flex-col items-center text-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
        <span className="sr-only">
          <Trans>Loading</Trans>
        </span>
      </div>
    );
  }

  if (session.status !== 'VALID' || isSessionError) {
    return <QrSignatureError reason={session.status !== 'VALID' ? session.status : undefined} />;
  }

  return (
    <div className="w-screen max-w-lg select-none px-4">
      <QrSignature token={token} context={session.context} />
    </div>
  );
}

type QrSignatureState = 'SIGNING' | 'SUCCESS' | 'EXPIRED' | 'ALREADY_SUBMITTED';

type QrSignatureProps = {
  token: string;
  context: TQrSignatureSessionContext;
};

const QrSignature = ({ token, context }: QrSignatureProps) => {
  const { t } = useLingui();

  const [signature, setSignature] = useState('');
  const [hasSubmissionError, setHasSubmissionError] = useState(false);

  const [state, setState] = useState<QrSignatureState>('SIGNING');

  // Portrait renders the pad in a bottom sheet beneath the document context;
  // landscape renders a single card. This component only ever renders on the
  // client (behind the session query), so the initial value can be read
  // synchronously - no flicker on landscape devices.
  const [isPortrait, setIsPortrait] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(orientation: portrait)').matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(orientation: portrait)');

    setIsPortrait(mediaQuery.matches);

    const onOrientationChange = (event: MediaQueryListEvent) => {
      setIsPortrait(event.matches);
    };

    mediaQuery.addEventListener('change', onOrientationChange);

    return () => {
      mediaQuery.removeEventListener('change', onOrientationChange);
    };
  }, []);

  const { mutateAsync: completeQrSignature, isPending } = trpc.signature.qr.complete.useMutation({
    // The session query must not refetch on completion: it would resolve to
    // ALREADY_SUBMITTED and replace the success screen with an error card.
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  });

  const contextInfo = useMemo(
    () =>
      match(context)
        .with({ type: 'DOCUMENT_SIGNATURE' }, (documentContext) => ({
          title: documentContext.documentTitle,
          subtitle: `${documentContext.teamName} · ${t`Signature requested`}`,
          icon: <FileTextIcon className="size-6 text-primary" />,
        }))
        .with({ type: 'PROFILE_SIGNATURE' }, () => ({
          title: t`Your signature`,
          subtitle: t`Signature requested`,
          icon: <PenLineIcon className="size-6 text-primary" />,
        }))
        // Context-less sessions show no subtitle, which would just repeat the title.
        .with({ type: 'NONE' }, () => ({
          title: t`Signature requested`,
          subtitle: null,
          icon: <PenLineIcon className="size-6 text-primary" />,
        }))
        .exhaustive(),
    [context, t],
  );

  const onSubmitClick = async () => {
    setHasSubmissionError(false);

    try {
      await completeQrSignature({
        token,
        signature,
      });

      setState('SUCCESS');
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.EXPIRED_CODE || error.code === AppErrorCode.NOT_FOUND) {
        setState('EXPIRED');
        return;
      }

      if (error.code === AppErrorCode.INVALID_REQUEST) {
        setState('ALREADY_SUBMITTED');
        return;
      }

      setHasSubmissionError(true);
    }
  };

  if (state === 'EXPIRED' || state === 'ALREADY_SUBMITTED') {
    return <QrSignatureError reason={state} />;
  }

  if (state === 'SUCCESS') {
    return (
      <div className="flex w-full flex-col items-center text-center">
        <CheckCircle2Icon className="size-10 text-primary" />

        <h1 className="mt-4 font-semibold text-2xl">
          <Trans>Success</Trans>
        </h1>

        <p className="mt-2 text-muted-foreground text-sm">
          <Trans>You can now return to your main device to continue.</Trans>
        </p>
      </div>
    );
  }

  if (isPortrait) {
    return (
      <>
        {/* Document context hero. */}
        <div className="flex flex-col items-center pb-[45svh] text-center">
          <div className="flex size-14 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            {contextInfo.icon}
          </div>

          <h1 className="mt-4 font-semibold text-2xl">{contextInfo.title}</h1>

          {contextInfo.subtitle && <p className="mt-2 text-muted-foreground text-sm">{contextInfo.subtitle}</p>}

          <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-muted-foreground text-xs">
            <span className="size-2 rounded-full bg-primary" />
            <Trans>Connected</Trans>
          </div>
        </div>

        {/* Persistent signing sheet - cannot be dismissed. */}
        <Sheet open>
          <SheetContent
            position="bottom"
            size="content"
            showOverlay={false}
            className="h-auto select-none rounded-t-2xl border-t px-4 pt-4 pb-6 [&>button:last-child]:hidden"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />

            <SheetTitle className="font-semibold text-lg">
              <Trans>Draw your signature</Trans>
            </SheetTitle>

            <div className="relative mt-3 flex aspect-signature-pad items-center justify-center rounded-md border border-border bg-muted/25">
              <SignaturePadDraw className="h-full w-full" value={signature} onChange={(value) => setSignature(value)} />
            </div>

            {hasSubmissionError && (
              <p className="mt-2 text-destructive text-sm">
                <Trans>Something went wrong. Please try again.</Trans>
              </p>
            )}

            <div className="mt-4 flex">
              <Button
                type="button"
                className="flex-1"
                disabled={!signature}
                loading={isPending}
                onClick={() => void onSubmitClick()}
              >
                <Trans>Next</Trans>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Landscape: a single card, no sheet.
  return (
    // Need this to override the parent layout styling.
    <div className="fixed inset-0 z-50 flex select-none items-center justify-center bg-background p-2">
      {/* The column width IS the pad width: all height left beneath the fixed
          h-12 header (100svh - 2*p-2 - h-12 - mb-2 = 100svh - 4.5rem) is
          converted through the pad's 16/7 aspect ratio, clamped by the
          viewport width. The header is w-full of the same column, so it always
          matches the pad width exactly. */}
      <div className="flex max-h-full w-[min(100%,calc((100svh-4.5rem)*16/7))] max-w-lg flex-col">
        <div className="mb-2 flex h-12 w-full shrink-0 items-center justify-between rounded-lg border border-border bg-muted/25 px-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              {contextInfo.icon}
            </div>

            <div className="min-w-0">
              <h1 className="truncate font-semibold text-sm">{contextInfo.title}</h1>

              <p className="truncate text-muted-foreground text-xs">{contextInfo.subtitle}</p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            className="ml-2 flex-shrink-0 px-6"
            disabled={!signature}
            loading={isPending}
            onClick={() => void onSubmitClick()}
          >
            <Trans>Next</Trans>
          </Button>
        </div>

        <div className="relative flex aspect-signature-pad w-full items-center justify-center rounded-md border border-border bg-muted/25">
          <SignaturePadDraw className="h-full w-full" value={signature} onChange={(value) => setSignature(value)} />
        </div>

        {hasSubmissionError && (
          <p className="mt-2 text-destructive text-sm">
            <Trans>Something went wrong. Please try again.</Trans>
          </p>
        )}
      </div>
    </div>
  );
};

type QrSignatureErrorReason = Exclude<TGetQrSignatureSessionResponse['status'], 'VALID'>;

type QrSignatureErrorProps = {
  reason?: QrSignatureErrorReason;
};

const QrSignatureError = ({ reason }: QrSignatureErrorProps) => {
  const content = match(reason)
    .with('EXPIRED', () => ({
      icon: <ClockIcon className="size-10 text-yellow-500" />,
      title: <Trans>This link has expired</Trans>,
      description: <Trans>Generate a new QR code on the original device and scan it again.</Trans>,
    }))
    .with('ALREADY_SUBMITTED', () => ({
      icon: <CheckCircle2Icon className="size-10 text-primary" />,
      title: <Trans>Signature already sent</Trans>,
      description: <Trans>This link has already been used. Return to your computer to continue.</Trans>,
    }))
    .with('INVALID', () => ({
      icon: <XCircleIcon className="size-10 text-muted-foreground" />,
      title: <Trans>This signing request is invalid</Trans>,
      description: (
        <Trans>
          The request is invalid or no longer exists. Scan the new QR code on the original device to try again.
        </Trans>
      ),
    }))
    .with(undefined, () => ({
      icon: <XCircleIcon className="size-10 text-muted-foreground" />,
      title: <Trans>Something went wrong</Trans>,
      description: <Trans>We couldn't load this signing request. Please refresh the page to try again.</Trans>,
    }))
    .exhaustive();

  return (
    <div className="flex w-full flex-col items-center text-center">
      {content.icon}

      <h1 className="mt-2 font-semibold text-2xl">{content.title}</h1>

      <p className="mt-2 text-muted-foreground text-sm">{content.description}</p>
    </div>
  );
};
