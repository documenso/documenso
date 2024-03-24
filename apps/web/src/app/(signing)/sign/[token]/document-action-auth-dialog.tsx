import { useMemo } from 'react';

import { P, match } from 'ts-pattern';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
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

import { DocumentActionAuth2FA } from './document-action-auth-2fa';
import { DocumentActionAuthAccount } from './document-action-auth-account';
import { DocumentActionAuthPasskey } from './document-action-auth-passkey';
import { useRequiredDocumentAuthContext } from './document-auth-provider';

export type DocumentActionAuthDialogProps = {
  title?: string;
  documentAuthType: TRecipientActionAuthTypes;
  description?: string;
  actionTarget?: 'FIELD' | 'DOCUMENT';
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
  actionTarget = 'FIELD',
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

  const actionVerb =
    actionTarget === 'DOCUMENT' ? RECIPIENT_ROLES_DESCRIPTION[recipient.role].actionVerb : 'Sign';

  const defaultTitleDescription = useMemo(() => {
    if (recipient.role === 'VIEWER' && actionTarget === 'DOCUMENT') {
      return {
        title: 'Mark document as viewed',
        description: 'Reauthentication is required to mark this document as viewed.',
      };
    }

    return {
      title: `${actionVerb} ${actionTarget.toLowerCase()}`,
      description: `Reauthentication is required to ${actionVerb.toLowerCase()} this ${actionTarget.toLowerCase()}`,
    };
  }, [recipient.role, actionVerb, actionTarget]);

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title || defaultTitleDescription.title}</DialogTitle>

          <DialogDescription>
            {description || defaultTitleDescription.description}
          </DialogDescription>
        </DialogHeader>

        {match({ documentAuthType, user })
          .with(
            { documentAuthType: DocumentAuth.ACCOUNT },
            { user: P.when((user) => !user || user.email !== recipient.email) }, // Assume all current auths requires them to be logged in.
            () => (
              <DocumentActionAuthAccount
                actionVerb={actionVerb}
                actionTarget={actionTarget}
                onOpenChange={onOpenChange}
              />
            ),
          )
          .with({ documentAuthType: DocumentAuth.PASSKEY }, () => (
            <DocumentActionAuthPasskey
              actionTarget={actionTarget}
              actionVerb={actionVerb}
              open={open}
              onOpenChange={onOpenChange}
              onReauthFormSubmit={onReauthFormSubmit}
            />
          ))
          .with({ documentAuthType: DocumentAuth['2FA'] }, () => (
            <DocumentActionAuth2FA
              actionTarget={actionTarget}
              actionVerb={actionVerb}
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
