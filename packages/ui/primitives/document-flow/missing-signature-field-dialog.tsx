import { Trans } from '@lingui/react/macro';
import { DialogClose } from '@radix-ui/react-dialog';

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
  onOpenChange: (value: boolean) => void;
};

export const MissingSignatureFieldDialog = ({
  isOpen,
  onOpenChange,
}: MissingSignatureFieldDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>No signature field found</Trans>
          </DialogTitle>
          <DialogDescription>
            <p className="mt-2">
              <Trans>
                Some signers have not been assigned a signature field. Please assign at least 1
                signature field to each signer before proceeding.
              </Trans>
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              <Trans>Close</Trans>
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
