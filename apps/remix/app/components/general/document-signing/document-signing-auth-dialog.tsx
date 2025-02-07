import { Trans } from '@lingui/react/macro';
import type { FieldType } from '@prisma/client';
import { P, match } from 'ts-pattern';

import {
  DocumentAuth,
  type TRecipientActionAuth,
  type TRecipientActionAuthTypes,
} from '@documenso/lib/types/document-auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

import { DocumentSigningAuth2FA } from './document-signing-auth-2fa';
import { DocumentSigningAuthAccount } from './document-signing-auth-account';
import { DocumentSigningAuthPasskey } from './document-signing-auth-passkey';
import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningAuthDialogProps = {
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

export const DocumentSigningAuthDialog = ({
  title,
  description,
  documentAuthType,
  open,
  onOpenChange,
  onReauthFormSubmit,
}: DocumentSigningAuthDialogProps) => {
  const { recipient, user, isCurrentlyAuthenticating } = useRequiredDocumentSigningAuthContext();

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
          <DialogTitle>{title || <Trans>Sign field</Trans>}</DialogTitle>

          <DialogDescription>
            {description || <Trans>Reauthentication is required to sign this field</Trans>}
          </DialogDescription>
        </DialogHeader>

        {match({ documentAuthType, user })
          .with(
            { documentAuthType: DocumentAuth.ACCOUNT },
            { user: P.when((user) => !user || user.email !== recipient.email) }, // Assume all current auth methods requires them to be logged in.
            () => <DocumentSigningAuthAccount onOpenChange={onOpenChange} />,
          )
          .with({ documentAuthType: DocumentAuth.PASSKEY }, () => (
            <DocumentSigningAuthPasskey
              open={open}
              onOpenChange={onOpenChange}
              onReauthFormSubmit={onReauthFormSubmit}
            />
          ))
          .with({ documentAuthType: DocumentAuth.TWO_FACTOR_AUTH }, () => (
            <DocumentSigningAuth2FA
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
