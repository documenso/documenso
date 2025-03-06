import { useMemo, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { RecipientRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { fieldsContainUnsignedRequiredField } from '@documenso/lib/utils/advanced-fields-helpers';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';

import { DocumentSigningDisclosure } from '~/components/general/document-signing/document-signing-disclosure';

export type DocumentSigningCompleteDialogProps = {
  isSubmitting: boolean;
  documentTitle: string;
  fields: Field[];
  fieldsValidated: () => void | Promise<void>;
  onSignatureComplete: () => void | Promise<void>;
  role: RecipientRole;
  disabled?: boolean;
};

export const DocumentSigningCompleteDialog = ({
  isSubmitting,
  documentTitle,
  fields,
  fieldsValidated,
  onSignatureComplete,
  role,
  disabled = false,
}: DocumentSigningCompleteDialogProps) => {
  const [showDialog, setShowDialog] = useState(false);

  const isComplete = useMemo(() => !fieldsContainUnsignedRequiredField(fields), [fields]);

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
          {match({ isComplete, role })
            .with({ isComplete: false }, () => <Trans>Next field</Trans>)
            .with({ isComplete: true, role: RecipientRole.APPROVER }, () => <Trans>Approve</Trans>)
            .with({ isComplete: true, role: RecipientRole.VIEWER }, () => (
              <Trans>Mark as viewed</Trans>
            ))
            .with({ isComplete: true }, () => <Trans>Complete</Trans>)
            .exhaustive()}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>
          <div className="text-foreground text-xl font-semibold">
            {match(role)
              .with(RecipientRole.VIEWER, () => <Trans>Complete Viewing</Trans>)
              .with(RecipientRole.SIGNER, () => <Trans>Complete Signing</Trans>)
              .with(RecipientRole.APPROVER, () => <Trans>Complete Approval</Trans>)
              .with(RecipientRole.CC, () => <Trans>Complete Viewing</Trans>)
              .with(RecipientRole.ASSISTANT, () => <Trans>Complete Assisting</Trans>)
              .exhaustive()}
          </div>
        </DialogTitle>

        <div className="text-muted-foreground max-w-[50ch]">
          {match(role)
            .with(RecipientRole.VIEWER, () => (
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
            ))
            .with(RecipientRole.SIGNER, () => (
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
            ))
            .with(RecipientRole.APPROVER, () => (
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
            ))
            .otherwise(() => (
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
            ))}
        </div>

        <DocumentSigningDisclosure className="mt-4" />

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
              {match(role)
                .with(RecipientRole.VIEWER, () => <Trans>Mark as Viewed</Trans>)
                .with(RecipientRole.SIGNER, () => <Trans>Sign</Trans>)
                .with(RecipientRole.APPROVER, () => <Trans>Approve</Trans>)
                .with(RecipientRole.CC, () => <Trans>Mark as Viewed</Trans>)
                .with(RecipientRole.ASSISTANT, () => <Trans>Complete</Trans>)
                .exhaustive()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
