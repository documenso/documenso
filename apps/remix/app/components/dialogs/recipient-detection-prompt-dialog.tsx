import { useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { match } from 'ts-pattern';

import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

import type { RecipientForCreation } from '~/utils/detect-document-recipients';

import { SuggestedRecipientsForm } from './suggested-recipients-form';

type RecipientDetectionStep =
  | 'PROMPT_DETECT_RECIPIENTS'
  | 'DETECTING_RECIPIENTS'
  | 'REVIEW_RECIPIENTS'
  | 'DETECTING_FIELDS';

export type RecipientDetectionPromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => Promise<void> | void;
  onSkip: () => void;
  recipients: RecipientForCreation[] | null;
  onRecipientsSubmit: (recipients: RecipientForCreation[]) => Promise<void> | void;
  onAutoAddFields?: (recipients: RecipientForCreation[]) => Promise<void> | void;
  isProcessingRecipients?: boolean;
};

export const RecipientDetectionPromptDialog = ({
  open,
  onOpenChange,
  onAccept,
  onSkip,
  recipients,
  onRecipientsSubmit,
  onAutoAddFields,
  isProcessingRecipients = false,
}: RecipientDetectionPromptDialogProps) => {
  const [currentStep, setCurrentStep] = useState<RecipientDetectionStep>(
    'PROMPT_DETECT_RECIPIENTS',
  );
  const [currentRecipients, setCurrentRecipients] = useState<RecipientForCreation[] | null>(
    recipients,
  );

  useEffect(() => {
    if (!open) {
      setCurrentStep('PROMPT_DETECT_RECIPIENTS');
    }
  }, [open]);

  useEffect(() => {
    setCurrentRecipients(recipients);
  }, [recipients]);

  useEffect(() => {
    if (recipients && currentStep === 'DETECTING_RECIPIENTS') {
      setCurrentStep('REVIEW_RECIPIENTS');
    }
  }, [recipients, currentStep]);

  const handleStartDetection = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentStep('DETECTING_RECIPIENTS');

    Promise.resolve(onAccept()).catch(() => {
      setCurrentStep('PROMPT_DETECT_RECIPIENTS');
    });
  };

  const handleSkip = () => {
    onSkip();
  };

  const handleAutoAddFields = async (recipients: RecipientForCreation[]) => {
    if (!onAutoAddFields) {
      return;
    }

    // Save the current state of recipients so if we fail and come back,
    // the form is restored with the user's changes.
    setCurrentRecipients(recipients);
    setCurrentStep('DETECTING_FIELDS');

    try {
      await onAutoAddFields(recipients);
    } catch {
      setCurrentStep('REVIEW_RECIPIENTS');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        // Prevent closing during processing
        if (
          !newOpen &&
          (currentStep === 'DETECTING_RECIPIENTS' ||
            currentStep === 'DETECTING_FIELDS' ||
            isProcessingRecipients)
        ) {
          return;
        }
        onOpenChange(newOpen);
      }}
    >
      <DialogContent
        className={
          currentStep === 'REVIEW_RECIPIENTS' ? 'max-h-[90vh] max-w-4xl overflow-y-auto' : ''
        }
      >
        <fieldset
          disabled={currentStep === 'DETECTING_RECIPIENTS' || currentStep === 'DETECTING_FIELDS'}
        >
          <AnimateGenericFadeInOut motionKey={currentStep} className="grid gap-4">
            {match(currentStep)
              .with('PROMPT_DETECT_RECIPIENTS', () => (
                <>
                  <DialogHeader>
                    <DialogTitle>
                      <Trans>Auto-detect recipients?</Trans>
                    </DialogTitle>
                    <DialogDescription>
                      <Trans>
                        Would you like to automatically detect recipients in your document? This can
                        save you time in setting up your document.
                      </Trans>
                    </DialogDescription>
                  </DialogHeader>

                  <DialogFooter>
                    <Button variant="ghost" onClick={handleSkip}>
                      <Trans>Skip for now</Trans>
                    </Button>
                    <Button onClick={handleStartDetection}>
                      <Trans>Detect recipients</Trans>
                    </Button>
                  </DialogFooter>
                </>
              ))
              .with('DETECTING_RECIPIENTS', () => (
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative mb-4 flex items-center justify-center">
                    <div
                      className="border-muted-foreground/20 dark:bg-muted/80 z-10 flex aspect-[3/4] w-24 origin-top-left flex-col gap-y-1 overflow-hidden rounded-lg border px-2 py-4 backdrop-blur-sm"
                      style={{ transform: 'translateZ(0px)' }}
                    >
                      <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]"></div>
                      <div className="bg-muted-foreground/20 h-2 w-5/6 rounded-[2px]"></div>
                      <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]"></div>

                      <div className="bg-muted-foreground/20 h-2 w-4/5 rounded-[2px]"></div>
                      <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]"></div>
                      <div className="bg-muted-foreground/20 h-2 w-3/4 rounded-[2px]"></div>
                    </div>

                    <div
                      className="bg-documenso/80 animate-scan pointer-events-none absolute left-1/2 top-0 z-20 h-0.5 w-24 -translate-x-1/2"
                      style={{
                        transform: 'translateX(-50%) translateZ(0px)',
                      }}
                    />
                  </div>

                  <DialogHeader>
                    <DialogTitle className="text-center">
                      <Trans>Analyzing your document</Trans>
                    </DialogTitle>
                    <DialogDescription className="text-center">
                      <Trans>
                        Scanning your document to detect recipient names, emails, and signing order.
                      </Trans>
                    </DialogDescription>
                  </DialogHeader>
                </div>
              ))
              .with('DETECTING_FIELDS', () => (
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative mb-4 flex items-center justify-center">
                    <div
                      className="border-muted-foreground/20 dark:bg-muted/80 z-10 flex aspect-[3/4] w-24 origin-top-left flex-col gap-y-1 overflow-hidden rounded-lg border px-2 py-4 backdrop-blur-sm"
                      style={{ transform: 'translateZ(0px)' }}
                    >
                      <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]"></div>
                      <div className="bg-muted-foreground/20 h-2 w-5/6 rounded-[2px]"></div>
                      <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]"></div>

                      <div className="bg-muted-foreground/20 h-2 w-4/5 rounded-[2px]"></div>
                      <div className="bg-muted-foreground/20 h-2 w-full rounded-[2px]"></div>
                      <div className="bg-muted-foreground/20 h-2 w-3/4 rounded-[2px]"></div>
                    </div>

                    <div
                      className="bg-documenso/80 animate-scan pointer-events-none absolute left-1/2 top-0 z-20 h-0.5 w-24 -translate-x-1/2"
                      style={{
                        transform: 'translateX(-50%) translateZ(0px)',
                      }}
                    />
                  </div>

                  <DialogHeader>
                    <DialogTitle className="text-center">
                      <Trans>Detecting fields</Trans>
                    </DialogTitle>
                    <DialogDescription className="text-center">
                      <Trans>
                        Scanning your document to intelligently place fields for your recipients.
                      </Trans>
                    </DialogDescription>
                  </DialogHeader>
                </div>
              ))
              .with('REVIEW_RECIPIENTS', () => (
                <>
                  <DialogHeader>
                    <DialogTitle>
                      <Trans>Review detected recipients</Trans>
                    </DialogTitle>
                    <DialogDescription>
                      <Trans>
                        Confirm, edit, or add recipients before continuing. You can adjust any
                        information below before importing it into your document.
                      </Trans>
                    </DialogDescription>
                  </DialogHeader>
                  <SuggestedRecipientsForm
                    recipients={currentRecipients}
                    onCancel={handleSkip}
                    onSubmit={onRecipientsSubmit}
                    onAutoAddFields={onAutoAddFields ? handleAutoAddFields : undefined}
                    isProcessing={isProcessingRecipients}
                  />
                </>
              ))
              .exhaustive()}
          </AnimateGenericFadeInOut>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
