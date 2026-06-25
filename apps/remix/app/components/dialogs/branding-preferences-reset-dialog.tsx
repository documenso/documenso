import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';

export type BrandingPreferencesResetDialogProps = {
  hasAdvancedBranding: boolean;
  isSubmitting: boolean;
  onReset: () => Promise<void>;
  trigger?: React.ReactNode;
};

export const BrandingPreferencesResetDialog = ({
  hasAdvancedBranding,
  isSubmitting,
  onReset,
  trigger,
}: BrandingPreferencesResetDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const isLoading = isSubmitting || isResetting;

  const handleResetToDefaults = async () => {
    setIsResetting(true);

    try {
      await onReset();
      setOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive" type="button">
            <Trans>Reset</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Reset branding preferences</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              This will reset all branding preferences to their default values and save the changes immediately.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="warning">
          <AlertDescription>
            <p>
              <Trans>Once confirmed, the following will be reset:</Trans>
            </p>

            <ul className="mt-0.5 list-inside list-disc">
              <li>
                <Trans>Custom branding enabled setting</Trans>
              </li>
              <li>
                <Trans>Branding logo</Trans>
              </li>
              <li>
                <Trans>Brand website and brand details</Trans>
              </li>
              <li>
                <Trans>Brand colours, including background, foreground, primary, and border colours</Trans>
              </li>

              {hasAdvancedBranding && (
                <>
                  <li>
                    <Trans>Border radius</Trans>
                  </li>
                  <li>
                    <Trans>Custom CSS</Trans>
                  </li>
                </>
              )}
            </ul>
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isLoading}>
              <Trans>Cancel</Trans>
            </Button>
          </DialogClose>

          <Button type="button" variant="destructive" loading={isLoading} onClick={() => void handleResetToDefaults()}>
            <Trans>Reset to defaults</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
