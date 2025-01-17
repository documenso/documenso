import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

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
  const title = hasUninsertedFields ? 'Warning' : 'Confirm Submission';
  const description = hasUninsertedFields
    ? "You haven't filled some of the fields for the signer roles, are you sure you want to proceed?"
    : "Are you sure you want to submit the assistant's form? This action cannot be undone.";

  return (
    <Dialog open={isOpen} onOpenChange={isSubmitting ? () => {} : onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
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
