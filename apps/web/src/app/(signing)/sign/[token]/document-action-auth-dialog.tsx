import { P, match } from 'ts-pattern';

import {
  DocumentAuth,
  type TRecipientActionAuth,
  type TRecipientActionAuthTypes,
} from '@documenso/lib/types/document-auth';
import type { FieldType } from '@documenso/prisma/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

import { DocumentActionAuth2FA } from './document-action-auth-2fa';
import { DocumentActionAuthAccount } from './document-action-auth-account';
import { DocumentActionAuthPasskey } from './document-action-auth-passkey';
import { useRequiredDocumentAuthContext } from './document-auth-provider';

export type DocumentActionAuthDialogProps = {
  title?: string;
  documentAuthType: TRecipientActionAuthTypes;
  description?: string;
  actionTarget: FieldType | 'DOCUMENT';
  open: boolean;
  onOpenChange: (value: boolean) => void;

  /**
   * The callback to run when the reauth form is filled out.
   */
  onReauthFormSubmit: (values?: TRecipientActionAuth) => Promise<void> | void;
};

export const DocumentActionAuthDialog = ({
  title,
  description,
  documentAuthType,
  open,
  onOpenChange,
  onReauthFormSubmit,
}: DocumentActionAuthDialogProps) => {
  const { recipient, user, isCurrentlyAuthenticating } = useRequiredDocumentAuthContext();

  const handleOnOpenChange = (value: boolean) => {
    if (isCurrentlyAuthenticating) {
      return;
    }

    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title || 'Sign field'}</DialogTitle>

          <DialogDescription>
            {description || 'Reauthentication is required to sign this field'}
          </DialogDescription>
        </DialogHeader>

        {match({ documentAuthType, user })
          .with(
            { documentAuthType: DocumentAuth.ACCOUNT },
            { user: P.when((user) => !user || user.email !== recipient.email) }, // Assume all current auth methods requires them to be logged in.
            () => <DocumentActionAuthAccount onOpenChange={onOpenChange} />,
          )
          .with({ documentAuthType: DocumentAuth.PASSKEY }, () => (
            <DocumentActionAuthPasskey
              open={open}
              onOpenChange={onOpenChange}
              onReauthFormSubmit={onReauthFormSubmit}
            />
          ))
          .with({ documentAuthType: DocumentAuth.TWO_FACTOR_AUTH }, () => (
            <DocumentActionAuth2FA
              open={open}
              onOpenChange={onOpenChange}
              onReauthFormSubmit={onReauthFormSubmit}
            />
          ))
          .with({ documentAuthType: DocumentAuth.EXPLICIT_NONE }, () => null)
          .exhaustive()}
      </DialogContent>
    </Dialog>
  );
};
