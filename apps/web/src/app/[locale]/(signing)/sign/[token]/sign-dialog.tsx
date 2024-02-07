'use client';

import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { Document, Field } from '@documenso/prisma/client';
import { RecipientRole } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';

import { truncateTitle } from '~/helpers/truncate-title';

export type SignDialogProps = {
  isSubmitting: boolean;
  document: Document;
  fields: Field[];
  fieldsValidated: () => void | Promise<void>;
  onSignatureComplete: () => void | Promise<void>;
  role: RecipientRole;
};

export const SignDialog = ({
  isSubmitting,
  document,
  fields,
  fieldsValidated,
  onSignatureComplete,
  role,
}: SignDialogProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const truncatedTitle = truncateTitle(document.title);
  const isComplete = fields.every((field) => field.inserted);
  const { t } = useTranslation();

  return (
    <Dialog open={showDialog && isComplete} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button
          className="w-full"
          type="button"
          size="lg"
          onClick={fieldsValidated}
          loading={isSubmitting}
        >
          {isComplete ? `${t('complete')}` : `${t('next_field')}`}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="text-center">
          <div className="text-foreground text-xl font-semibold">
            {role === RecipientRole.VIEWER && `${t('mark_document_as_viewed')}`}
            {role === RecipientRole.SIGNER && `${t('sign_document')}`}
            {role === RecipientRole.APPROVER && `${t('approve_document')}`}
          </div>
          <div className="text-muted-foreground mx-auto w-4/5 py-2 text-center">
            {role === RecipientRole.VIEWER &&
              `${t('you_are_about_to_finish_viewing', truncatedTitle)}`}
            {role === RecipientRole.SIGNER &&
              `${t('you_are_about_to_finish_signing', truncatedTitle)}`}
            {role === RecipientRole.APPROVER &&
              `${t('you_are_about_to_finish_approving', truncatedTitle)}`}
          </div>
        </div>

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
              {t('cancel')}
            </Button>

            <Button
              type="button"
              className="flex-1"
              disabled={!isComplete}
              loading={isSubmitting}
              onClick={onSignatureComplete}
            >
              {role === RecipientRole.VIEWER && `${t('mark_viewed')}`}
              {role === RecipientRole.SIGNER && `${t('sign')}`}
              {role === RecipientRole.APPROVER && `${t('approve')}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
