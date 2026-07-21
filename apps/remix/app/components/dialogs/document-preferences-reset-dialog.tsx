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

export type DocumentPreferencesResetDialogProps = {
  isSubmitting: boolean;
  onReset: () => Promise<void>;
  showAiFeatures?: boolean;
  showDocumentVisibility?: boolean;
  showIncludeSenderDetails?: boolean;
};

export const DocumentPreferencesResetDialog = ({
  isSubmitting,
  onReset,
  showAiFeatures = false,
  showDocumentVisibility = false,
  showIncludeSenderDetails = false,
}: DocumentPreferencesResetDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const isLoading = isSubmitting || isResetting;

  const handleResetToDefaults = async () => {
    setIsResetting(true);

    try {
      await onReset();
      setOpen(false);
    } catch {
      // The submit handler surfaces its own error toast. Keep the dialog open
      // so the user can retry.
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && setOpen(value)}>
      <DialogTrigger asChild>
        <Button variant="destructive" type="button" size="sm" disabled={isLoading}>
          <Trans>Reset to defaults</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Reset document preferences</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              This will reset all document preferences to their default values and save the changes immediately.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="warning">
          <AlertDescription>
            <p>
              <Trans>Once confirmed, the following will be reset:</Trans>
            </p>

            <ul className="mt-0.5 list-inside list-disc">
              {showDocumentVisibility && (
                <li>
                  <Trans>Default document visibility</Trans>
                </li>
              )}
              <li>
                <Trans>Default document language</Trans>
              </li>
              <li>
                <Trans>Default date format</Trans>
              </li>
              <li>
                <Trans>Default time zone</Trans>
              </li>
              <li>
                <Trans>Default signature settings</Trans>
              </li>
              {showIncludeSenderDetails && (
                <li>
                  <Trans>Send on behalf of team</Trans>
                </li>
              )}
              <li>
                <Trans>Include the signing certificate in the document</Trans>
              </li>
              <li>
                <Trans>Include the audit logs in the document</Trans>
              </li>
              <li>
                <Trans>Default recipients</Trans>
              </li>
              <li>
                <Trans>Delegate document ownership</Trans>
              </li>
              <li>
                <Trans>Default envelope expiration</Trans>
              </li>
              <li>
                <Trans>Default signing reminders</Trans>
              </li>
              {showAiFeatures && (
                <li>
                  <Trans>AI features</Trans>
                </li>
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
