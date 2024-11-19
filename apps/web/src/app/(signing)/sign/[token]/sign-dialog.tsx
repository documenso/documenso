import { useState } from 'react';

import { Trans } from '@lingui/macro';

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

export type SignDialogProps = {
  isSubmitting: boolean;
  documentTitle: string;
  fields: Field[];
  fieldsValidated: () => void | Promise<void>;
  onSignatureComplete: () => void | Promise<void>;
  role: RecipientRole;
  disabled?: boolean;
};

export const SignDialog = ({
  isSubmitting,
  documentTitle,
  fields,
  fieldsValidated,
  onSignatureComplete,
  role,
  disabled = false,
}: SignDialogProps) => {
  const [showDialog, setShowDialog] = useState(false);

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
          disabled={disabled}
        >
          {isComplete ? <Trans>Complete</Trans> : <Trans>Next field</Trans>}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>
          <div className="text-foreground text-xl font-semibold">
            {role === RecipientRole.VIEWER && <Trans>Complete Viewing</Trans>}
            {role === RecipientRole.SIGNER && <Trans>Complete Signing</Trans>}
            {role === RecipientRole.APPROVER && <Trans>Complete Approval</Trans>}
          </div>
        </DialogTitle>

        <div className="text-muted-foreground max-w-[50ch]">
          {role === RecipientRole.VIEWER && (
            <span>
              <Trans>
                <span className="inline-flex flex-wrap">
                  You are about to complete viewing "
                  <span className="inline-block max-w-[11rem] truncate align-baseline">
                    {documentTitle}
                  </span>
                  ".
                </span>
                <br /> Are you sure?
              </Trans>
            </span>
          )}
          {role === RecipientRole.SIGNER && (
            <span>
              <Trans>
                <span className="inline-flex flex-wrap">
                  You are about to complete signing "
                  <span className="inline-block max-w-[11rem] truncate align-baseline">
                    {documentTitle}
                  </span>
                  ".
                </span>
                <br /> Are you sure?
              </Trans>
            </span>
          )}
          {role === RecipientRole.APPROVER && (
            <span>
              <Trans>
                <span className="inline-flex flex-wrap">
                  You are about to complete approving{' '}
                  <span className="inline-block max-w-[11rem] truncate align-baseline">
                    "{documentTitle}"
                  </span>
                  .
                </span>
                <br /> Are you sure?
              </Trans>
            </span>
          )}
        </div>

        <SigningDisclosure className="mt-4" />

        <DialogFooter>
          <div className="flex w-full flex-1 flex-nowrap gap-4">
            <Button
              type="button"
              className="dark:bg-muted dark:hover:bg-muted/80 flex-1 bg-black/5 hover:bg-black/10"
              variant="secondary"
              onClick={() => {
                setShowDialog(false);
              }}
            >
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="button"
              className="flex-1"
              disabled={!isComplete}
              loading={isSubmitting}
              onClick={onSignatureComplete}
            >
              {role === RecipientRole.VIEWER && <Trans>Mark as Viewed</Trans>}
              {role === RecipientRole.SIGNER && <Trans>Sign</Trans>}
              {role === RecipientRole.APPROVER && <Trans>Approve</Trans>}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
