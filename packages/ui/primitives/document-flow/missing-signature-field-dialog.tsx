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

export type MissingSignatureFieldDialogProps = {
  isOpen: boolean;
  onOpenChange: () => void;
  onConfirm: () => void;
};

export const MissingSignatureFieldDialog = ({
  isOpen,
  onOpenChange,
  onConfirm,
}: MissingSignatureFieldDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" position="center">
        <DialogHeader>
          <DialogTitle>No signature field found</DialogTitle>
          <DialogDescription>
            <p className="mt-2">
              Some signers have not been assigned a signature field. Please assign a signature field
              to each signer before proceeding.
            </p>
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
