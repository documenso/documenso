import { useCallback, useEffect, useMemo, useState } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { CheckIcon, FormInputIcon, ShieldCheckIcon } from 'lucide-react';

import type { NormalizedFieldWithContext } from '@documenso/lib/server-only/ai/envelope/detect-fields/types';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Label } from '@documenso/ui/primitives/label';
import { Textarea } from '@documenso/ui/primitives/textarea';

import {
  AiApiError,
  type DetectFieldsProgressEvent,
  detectFields,
} from '../../../server/api/ai/detect-fields.client';
import { AnimatedDocumentScanner } from '../general/animated-document-scanner';

type DialogState = 'PROMPT' | 'PROCESSING' | 'REVIEW' | 'ERROR' | 'RATE_LIMITED';

type AiFieldDetectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (fields: NormalizedFieldWithContext[]) => void;
  envelopeId: string;
  teamId: number;
};

const PROCESSING_MESSAGES = [
  msg`Reading your document`,
  msg`Analyzing page layout`,
  msg`Looking for form fields`,
  msg`Detecting signature areas`,
  msg`Identifying input fields`,
  msg`Mapping fields to recipients`,
  msg`Almost done`,
] as const;

const FIELD_TYPE_LABELS: Record<string, MessageDescriptor> = {
  SIGNATURE: msg`Signature`,
  INITIALS: msg`Initials`,
  NAME: msg`Name`,
  EMAIL: msg`Email`,
  DATE: msg`Date`,
  TEXT: msg`Text`,
  NUMBER: msg`Number`,
  CHECKBOX: msg`Checkbox`,
  RADIO: msg`Radio`,
};

export const AiFieldDetectionDialog = ({
  open,
  onOpenChange,
  onComplete,
  envelopeId,
  teamId,
}: AiFieldDetectionDialogProps) => {
  const { _ } = useLingui();

  const [state, setState] = useState<DialogState>('PROMPT');
  const [messageIndex, setMessageIndex] = useState(0);
  const [detectedFields, setDetectedFields] = useState<NormalizedFieldWithContext[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [progress, setProgress] = useState<DetectFieldsProgressEvent | null>(null);

  const onDetectClick = useCallback(async () => {
    setState('PROCESSING');
    setMessageIndex(0);
    setError(null);
    setProgress(null);

    try {
      await detectFields({
        request: {
          envelopeId,
          teamId,
          context: context || undefined,
        },
        onProgress: (progressEvent) => {
          setProgress(progressEvent);
        },
        onComplete: (event) => {
          setDetectedFields(event.fields);
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

      setError(err instanceof Error ? err.message : 'Failed to detect fields');
      setState('ERROR');
    }
  }, [envelopeId, teamId, context]);

  const onAddFields = () => {
    onComplete(detectedFields);
    onOpenChange(false);
    setState('PROMPT');
    setDetectedFields([]);
    setContext('');
  };

  const onClose = () => {
    onOpenChange(false);
    setState('PROMPT');
    setDetectedFields([]);
    setError(null);
    setContext('');
    setProgress(null);
  };

  // Group fields by type for summary display
  const fieldCountsByType = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const field of detectedFields) {
      counts[field.type] = (counts[field.type] || 0) + 1;
    }

    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [detectedFields]);

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
                <Trans>Detect fields</Trans>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <Trans>
                  We'll scan your document to find form fields like signature lines, text inputs,
                  checkboxes, and more. Detected fields will be suggested for you to review.
                </Trans>
              </p>

              <Alert className="flex items-center gap-2 space-y-0" variant="neutral">
                <ShieldCheckIcon className="h-5 w-5 stroke-green-600" />
                <AlertDescription className="mt-0">
                  <Trans>
                    Your document is processed securely using AI services that don't retain your
                    data.
                  </Trans>
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                <Label htmlFor="context">
                  <Trans>Context</Trans>
                </Label>
                <Textarea
                  id="context"
                  placeholder={_(msg`David is the Employee, Lucas is the Manager`)}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  <Trans>Help the AI assign fields to the right recipients.</Trans>
                </p>
              </div>
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
                <Trans>Detecting fields</Trans>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center py-8">
              <AnimatedDocumentScanner />

              <p className="mt-8 text-muted-foreground">{_(PROCESSING_MESSAGES[messageIndex])}</p>

              {progress && (
                <p className="mt-2 text-xs text-muted-foreground/60">
                  <Trans>
                    Page {progress.pagesProcessed} of {progress.totalPages} -{' '}
                    {progress.fieldsDetected} field(s) found
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
                <Trans>Detected fields</Trans>
              </DialogTitle>
            </DialogHeader>

            <div className="max-h-[400px] overflow-y-auto">
              {detectedFields.length === 0 ? (
                <div className="flex flex-col items-center py-8">
                  <FormInputIcon className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    <Trans>No fields were detected in your document.</Trans>
                  </p>
                  <p className="mt-1 text-center text-xs text-muted-foreground/70">
                    <Trans>You can add fields manually in the editor.</Trans>
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    <Trans>We found {detectedFields.length} field(s) in your document.</Trans>
                  </p>

                  <ul className="mt-4 divide-y rounded-lg border">
                    {fieldCountsByType.map(([type, count]) => (
                      <li key={type} className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm">{_(FIELD_TYPE_LABELS[type]) || type}</span>
                        <span className="text-sm font-medium text-muted-foreground">{count}</span>
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

              {detectedFields.length > 0 && (
                <Button type="button" onClick={onAddFields}>
                  <CheckIcon className="-ml-1 mr-2 h-4 w-4" />
                  <Trans>Add fields</Trans>
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
                <Trans>Something went wrong while detecting fields.</Trans>
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
