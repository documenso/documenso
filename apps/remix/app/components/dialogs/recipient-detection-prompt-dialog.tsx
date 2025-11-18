import { useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { LoaderIcon } from 'lucide-react';
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

type RecipientDetectionStep = 'PROMPT' | 'PROCESSING';

export type RecipientDetectionPromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => Promise<void> | void;
  onSkip: () => void;
};

export const RecipientDetectionPromptDialog = ({
  open,
  onOpenChange,
  onAccept,
  onSkip,
}: RecipientDetectionPromptDialogProps) => {
  const [currentStep, setCurrentStep] = useState<RecipientDetectionStep>('PROMPT');

  // Reset to first step when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep('PROMPT');
    }
  }, [open]);

  const handleStartDetection = () => {
    setCurrentStep('PROCESSING');

    Promise.resolve(onAccept()).catch(() => {
      setCurrentStep('PROMPT');
    });
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <fieldset disabled={currentStep === 'PROCESSING'}>
          <AnimateGenericFadeInOut motionKey={currentStep}>
            {match(currentStep)
              .with('PROMPT', () => (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
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
                    <Button type="button" variant="secondary" onClick={handleSkip}>
                      <Trans>Skip for now</Trans>
                    </Button>
                    <Button type="button" onClick={handleStartDetection}>
                      <Trans>Detect recipients</Trans>
                    </Button>
                  </DialogFooter>
                </>
              ))
              .with('PROCESSING', () => (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center justify-center gap-2">
                      <LoaderIcon className="h-5 w-5 animate-spin" />
                      <Trans>Analyzing your document</Trans>
                    </DialogTitle>
                    <DialogDescription className="text-center">
                      <Trans>
                        Scanning your document to detect recipient names, emails, and signing order.
                      </Trans>
                    </DialogDescription>
                  </DialogHeader>
                </>
              ))
              .exhaustive()}
          </AnimateGenericFadeInOut>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
