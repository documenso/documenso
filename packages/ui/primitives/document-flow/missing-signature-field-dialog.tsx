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
              Some signers have not been assigned a signature field. As a result, they may place
              their signature anywhere on the document.
            </p>
            <p className="mt-4">
              If you would like to assign a signature field to each signer, please click the
              "Cancel" and add the missing signature fields.
            </p>
            <p className="mt-4">Otherwise, click "Proceed" to continue.</p>
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
