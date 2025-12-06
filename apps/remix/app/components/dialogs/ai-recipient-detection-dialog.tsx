import { useCallback, useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { CheckIcon, ShieldCheckIcon, UserIcon, XIcon } from 'lucide-react';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { TDetectedRecipientSchema } from '@documenso/lib/server-only/ai/envelope/detect-recipients/schema';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

import {
  AiApiError,
  type DetectRecipientsProgressEvent,
  detectRecipients,
} from '../../../server/api/ai/detect-recipients.client';
import { AnimatedDocumentScanner } from '../general/animated-document-scanner';

type DialogState = 'PROMPT' | 'PROCESSING' | 'REVIEW' | 'ERROR' | 'RATE_LIMITED';

type AiRecipientDetectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (recipients: TDetectedRecipientSchema[]) => void;
  envelopeId: string;
  teamId: number;
};

const PROCESSING_MESSAGES = [
  msg`Reading your document`,
  msg`Analyzing pages`,
  msg`Looking for signature fields`,
  msg`Identifying recipients`,
  msg`Extracting contact details`,
  msg`Almost done`,
] as const;

export const AiRecipientDetectionDialog = ({
  open,
  onOpenChange,
  onComplete,
  envelopeId,
  teamId,
}: AiRecipientDetectionDialogProps) => {
  const { _ } = useLingui();

  const [state, setState] = useState<DialogState>('PROMPT');
  const [messageIndex, setMessageIndex] = useState(0);
  const [detectedRecipients, setDetectedRecipients] = useState<TDetectedRecipientSchema[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DetectRecipientsProgressEvent | null>(null);

  const onDetectClick = useCallback(async () => {
    setState('PROCESSING');
    setMessageIndex(0);
    setError(null);
    setProgress(null);

    try {
      await detectRecipients({
        request: {
          envelopeId,
          teamId,
        },
        onProgress: (progressEvent) => {
          setProgress(progressEvent);
        },
        onComplete: (event) => {
          setDetectedRecipients(event.recipients);
          setState('REVIEW');
        },
        onError: (err) => {
          console.error('Detection failed:', err);

          if (err.status === 429) {
            setState('RATE_LIMITED');
            return;
          }

          setError(err.message);
          setState('ERROR');
        },
      });
    } catch (err) {
      console.error('Detection failed:', err);

      if (err instanceof AiApiError && err.status === 429) {
        setState('RATE_LIMITED');
        return;
      }

      setError(err instanceof Error ? err.message : 'Failed to detect recipients');
      setState('ERROR');
    }
  }, [envelopeId, teamId]);

  const handleRemoveRecipient = (index: number) => {
    setDetectedRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const onAddRecipients = () => {
    onComplete(detectedRecipients);
    onOpenChange(false);
    setState('PROMPT');
    setDetectedRecipients([]);
  };

  const onClose = () => {
    onOpenChange(false);
    setState('PROMPT');
    setDetectedRecipients([]);
    setError(null);
    setProgress(null);
  };

  useEffect(() => {
    if (state !== 'PROCESSING') {
      return;
    }

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % PROCESSING_MESSAGES.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [state]);

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-lg" hideClose={true}>
        {state === 'PROMPT' && (
          <>
            <DialogHeader>
              <DialogTitle>
                <Trans>Detect recipients</Trans>
              </DialogTitle>
            </DialogHeader>

            <div>
              <p className="text-sm text-muted-foreground">
                <Trans>
                  We'll scan your document to find signature fields and identify who needs to sign.
                  Detected recipients will be suggested for you to review.
                </Trans>
              </p>

              <Alert className="mt-4 flex items-center gap-2 space-y-0" variant="neutral">
                <ShieldCheckIcon className="h-5 w-5 stroke-green-600" />
                <AlertDescription className="mt-0">
                  <Trans>
                    Your document is processed securely using AI services that don't retain your
                    data.
                  </Trans>
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                <Trans>Skip</Trans>
              </Button>
              <Button type="button" onClick={onDetectClick}>
                <Trans>Detect</Trans>
              </Button>
            </DialogFooter>
          </>
        )}

        {state === 'PROCESSING' && (
          <>
            <DialogHeader>
              <DialogTitle>
                <Trans>Detecting recipients</Trans>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center py-8">
              <AnimatedDocumentScanner />

              <p className="mt-8 text-muted-foreground">{_(PROCESSING_MESSAGES[messageIndex])}</p>

              {progress && (
                <p className="mt-2 text-xs text-muted-foreground/60">
                  <Trans>
                    Page {progress.pagesProcessed} of {progress.totalPages} -{' '}
                    {progress.recipientsDetected} recipient(s) found
                  </Trans>
                </p>
              )}

              <p className="mt-2 max-w-[40ch] text-center text-xs text-muted-foreground/60">
                <Trans>This can take a minute or two depending on the size of your document.</Trans>
              </p>

              <div className="mt-4 flex gap-1">
                {PROCESSING_MESSAGES.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                      index === messageIndex ? 'w-4 bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {state === 'REVIEW' && (
          <>
            <DialogHeader>
              <DialogTitle>
                <Trans>Detected recipients</Trans>
              </DialogTitle>
            </DialogHeader>

            <div className="max-h-[400px] overflow-y-auto">
              {detectedRecipients.length === 0 ? (
                <div className="flex flex-col items-center py-8">
                  <UserIcon className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    <Trans>No recipients were detected in your document.</Trans>
                  </p>
                  <p className="mt-1 text-center text-xs text-muted-foreground/70">
                    <Trans>You can add recipients manually in the editor.</Trans>
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    <Trans>
                      We found {detectedRecipients.length} recipient(s) in your document.
                    </Trans>
                  </p>

                  <ul className="mt-4 divide-y rounded-lg border">
                    {detectedRecipients.map((recipient, index) => (
                      <li key={index} className="flex items-center justify-between px-4 py-3">
                        <AvatarWithText
                          avatarFallback={
                            recipient.name
                              ? recipient.name.slice(0, 1).toUpperCase()
                              : recipient.email
                                ? recipient.email.slice(0, 1).toUpperCase()
                                : '?'
                          }
                          primaryText={
                            <p className="text-sm font-medium text-foreground">
                              {recipient.name || _(msg`Unknown name`)}
                            </p>
                          }
                          secondaryText={
                            <div className="text-xs text-muted-foreground">
                              <p className="italic text-muted-foreground/70">
                                {recipient.email || _(msg`No email detected`)}
                              </p>
                              <p>{_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}</p>
                            </div>
                          }
                        />

                        <button
                          type="button"
                          className="h-8 w-8 p-0 text-muted-foreground/80 hover:text-destructive focus-visible:border-destructive focus-visible:ring-destructive"
                          onClick={() => handleRemoveRecipient(index)}
                        >
                          <span className="sr-only">
                            <Trans>Remove recipient</Trans>
                          </span>

                          <XIcon className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                <Trans>Cancel</Trans>
              </Button>

              {detectedRecipients.length > 0 && (
                <Button type="button" onClick={onAddRecipients}>
                  <CheckIcon className="-ml-1 mr-2 h-4 w-4" />
                  <Trans>Add recipients</Trans>
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {state === 'ERROR' && (
          <>
            <DialogHeader>
              <DialogTitle>
                <Trans>Detection failed</Trans>
              </DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                <Trans>Something went wrong while detecting recipients.</Trans>
              </p>

              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                <Trans>Close</Trans>
              </Button>

              <Button type="button" onClick={onDetectClick}>
                <Trans>Try again</Trans>
              </Button>
            </DialogFooter>
          </>
        )}

        {state === 'RATE_LIMITED' && (
          <>
            <DialogHeader>
              <DialogTitle>
                <Trans>Too many requests</Trans>
              </DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                <Trans>
                  You've made too many detection requests. Please wait a minute before trying again.
                </Trans>
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                <Trans>Close</Trans>
              </Button>
              <Button type="button" onClick={onDetectClick}>
                <Trans>Try again</Trans>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
