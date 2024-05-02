'use client';

import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

export type NoSignatureHintDialogProps = {
  isOpen: boolean;
  onOpenChange: () => void;
  onConfirm: () => void;
};

export const NoSignatureHintDialog = ({
  isOpen,
  onOpenChange,
  onConfirm,
}: NoSignatureHintDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" position="center">
        <DialogHeader>
          <DialogTitle>No signature field found</DialogTitle>
          <DialogDescription>
            <p className="mt-2">
              You do not have a signature field for your signers. They will be able to sign wherever
              they want.
            </p>
            <p className="mt-4">To avoid that, please add a signature field for your signers.</p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <div className="flex w-full flex-nowrap gap-4">
            <Button type="button" variant="secondary" onClick={onOpenChange}>
              Cancel
            </Button>
            <Button type="submit" onClick={onConfirm}>
              Proceed
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
