import { useState } from 'react';

import type { Field } from '@documenso/prisma/client';
import { RecipientRole } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';

import { SigningDisclosure } from '~/components/general/signing-disclosure';
import { truncateTitle } from '~/helpers/truncate-title';

export type SignDialogProps = {
  isSubmitting: boolean;
  documentTitle: string;
  fields: Field[];
  fieldsValidated: () => void | Promise<void>;
  onSignatureComplete: () => void | Promise<void>;
  role: RecipientRole;
};

export const SignDialog = ({
  isSubmitting,
  documentTitle,
  fields,
  fieldsValidated,
  onSignatureComplete,
  role,
}: SignDialogProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const truncatedTitle = truncateTitle(documentTitle);
  const isComplete = fields.every((field) => field.inserted);

  const handleOpenChange = (open: boolean) => {
    if (isSubmitting || !isComplete) {
      return;
    }

    setShowDialog(open);
  };

  return (
    <Dialog open={showDialog} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="w-full"
          type="button"
          size="lg"
          onClick={fieldsValidated}
          loading={isSubmitting}
        >
          {isComplete ? 'Complete' : 'Next field'}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>
          <div className="text-foreground text-xl font-semibold">
            {role === RecipientRole.VIEWER && 'Complete Viewing'}
            {role === RecipientRole.SIGNER && 'Complete Signing'}
            {role === RecipientRole.APPROVER && 'Complete Approval'}
          </div>
        </DialogTitle>

        <div className="text-muted-foreground max-w-[50ch]">
          {role === RecipientRole.VIEWER && (
            <span>
              You are about to complete viewing "{truncatedTitle}".
              <br /> Are you sure?
            </span>
          )}
          {role === RecipientRole.SIGNER && (
            <span>
              You are about to complete signing "{truncatedTitle}".
              <br /> Are you sure?
            </span>
          )}
          {role === RecipientRole.APPROVER && (
            <span>
              You are about to complete approving "{truncatedTitle}".
              <br /> Are you sure?
            </span>
          )}
        </div>

        <SigningDisclosure className="mt-4" />

        <DialogFooter>
          <div className="flex w-full flex-1 flex-nowrap gap-4">
            <Button
              type="button"
              className="dark:bg-muted dark:hover:bg-muted/80 flex-1  bg-black/5 hover:bg-black/10"
              variant="secondary"
              onClick={() => {
                setShowDialog(false);
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              className="flex-1"
              disabled={!isComplete}
              loading={isSubmitting}
              onClick={onSignatureComplete}
            >
              {role === RecipientRole.VIEWER && 'Mark as Viewed'}
              {role === RecipientRole.SIGNER && 'Sign'}
              {role === RecipientRole.APPROVER && 'Approve'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
