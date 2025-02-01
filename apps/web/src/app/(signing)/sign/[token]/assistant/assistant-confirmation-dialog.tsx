import { Trans } from '@lingui/macro';

import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

import { SigningDisclosure } from '~/components/general/signing-disclosure';

type ConfirmationDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  hasUninsertedFields: boolean;
  isSubmitting: boolean;
};

export function AssistantConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  hasUninsertedFields,
  isSubmitting,
}: ConfirmationDialogProps) {
  const description = hasUninsertedFields
    ? "You haven't filled some of the fields for the signer roles, are you sure you want to proceed?"
    : "Are you sure you want to submit the assistant's form? This action cannot be undone.";

  const handleOpenChange = () => {
    if (isSubmitting) {
      return;
    }

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Complete Document</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Are you sure you want to complete the document? This action cannot be undone. Please
              ensure that you have completed prefilling all relevant fields before proceeding.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <SigningDisclosure />
        </div>

        <DialogFooter className="mt-4">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={hasUninsertedFields ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : hasUninsertedFields ? 'Proceed' : 'Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
