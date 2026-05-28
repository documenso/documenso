import { Trans } from '@lingui/react/macro';
import { DialogClose } from '@radix-ui/react-dialog';

import type { TRecipientLite } from '@documenso/lib/types/recipient';
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
  recipientsMissingFields?: Pick<TRecipientLite, 'id' | 'name' | 'email'>[];
};

export const MissingSignatureFieldDialog = ({
  isOpen,
  onOpenChange,
  recipientsMissingFields = [],
}: MissingSignatureFieldDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>No fields assigned to signer</Trans>
          </DialogTitle>
          <DialogDescription>
            <p className="mt-2">
              <Trans>
                Some signers have not been assigned any fields. Please assign at least one field to
                each signer before proceeding — a signature field if they need to sign, or any
                other field type (e.g. Text) if they only need to fill in data.
              </Trans>
            </p>
          </DialogDescription>
        </DialogHeader>

        {recipientsMissingFields.length > 0 && (
          <ul className="-mt-2 list-inside list-disc text-sm text-muted-foreground">
            {recipientsMissingFields.map((recipient) => (
              <li key={recipient.id}>{recipient.name || recipient.email}</li>
            ))}
          </ul>
        )}

        <div className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
          <Trans>
            Only need someone to receive or view the document? Change their role to{' '}
            <strong>Viewer</strong> or <strong>CC</strong> — those recipients don't need any
            fields.
          </Trans>
        </div>

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
