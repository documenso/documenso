import { Trans } from '@lingui/react/macro';

import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

import { DocumentSigningDisclosure } from '../general/document-signing/document-signing-disclosure';

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
  const onOpenChange = () => {
    if (isSubmitting) {
      return;
    }

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
          <DocumentSigningDisclosure />
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
