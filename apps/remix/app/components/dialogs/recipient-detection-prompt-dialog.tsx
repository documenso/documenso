import { useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { match } from 'ts-pattern';

import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@documenso/ui/primitives/alert-dialog';

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

  useEffect(() => {
    if (!open) {
      setCurrentStep('PROMPT');
    }
  }, [open]);

  const handleStartDetection = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentStep('PROCESSING');

    Promise.resolve(onAccept()).catch(() => {
      setCurrentStep('PROMPT');
    });
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <fieldset disabled={currentStep === 'PROCESSING'}>
          <AnimateGenericFadeInOut motionKey={currentStep} className="grid gap-4">
            {match(currentStep)
              .with('PROMPT', () => (
                <>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      <Trans>Auto-detect recipients?</Trans>
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      <Trans>
                        Would you like to automatically detect recipients in your document? This can
                        save you time in setting up your document.
                      </Trans>
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleSkip}>
                      <Trans>Skip for now</Trans>
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleStartDetection}>
                      <Trans>Detect recipients</Trans>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </>
              ))
              .with('PROCESSING', () => (
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

                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-center">
                      <Trans>Analyzing your document</Trans>
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-center">
                      <Trans>
                        Scanning your document to detect recipient names, emails, and signing order.
                      </Trans>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                </div>
              ))
              .exhaustive()}
          </AnimateGenericFadeInOut>
        </fieldset>
      </AlertDialogContent>
    </AlertDialog>
  );
};
