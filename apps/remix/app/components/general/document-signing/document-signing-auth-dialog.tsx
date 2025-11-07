import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import type { FieldType } from '@prisma/client';
import { ChevronLeftIcon } from 'lucide-react';
import { P, match } from 'ts-pattern';

import {
  DocumentAuth,
  type TRecipientActionAuth,
  type TRecipientActionAuthTypes,
} from '@documenso/lib/types/document-auth';
import { Button } from '@documenso/ui/primitives/button';
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
import { DocumentSigningAuthPassword } from './document-signing-auth-password';
import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningAuthDialogProps = {
  title?: string;
  availableAuthTypes: TRecipientActionAuthTypes[];
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
  availableAuthTypes,
  open,
  onOpenChange,
  onReauthFormSubmit,
}: DocumentSigningAuthDialogProps) => {
  const { recipient, user, isCurrentlyAuthenticating, isDirectTemplate } =
    useRequiredDocumentSigningAuthContext();

  // Filter out EXPLICIT_NONE from available auth types for the chooser
  const validAuthTypes = availableAuthTypes.filter(
    (authType) => authType !== DocumentAuth.EXPLICIT_NONE,
  );

  const [selectedAuthType, setSelectedAuthType] = useState<TRecipientActionAuthTypes | null>(() => {
    // Auto-select if there's only one valid option
    if (validAuthTypes.length === 1) {
      return validAuthTypes[0];
    }
    // Return null if multiple options - show chooser
    return null;
  });

  const handleOnOpenChange = (value: boolean) => {
    if (isCurrentlyAuthenticating) {
      return;
    }

    // Reset selected auth type when dialog closes
    if (!value) {
      setSelectedAuthType(() => {
        if (validAuthTypes.length === 1) {
          return validAuthTypes[0];
        }

        return null;
      });
    }

    onOpenChange(value);
  };

  const handleBackToChooser = () => {
    setSelectedAuthType(null);
  };

  // If no valid auth types available, don't render anything
  if (validAuthTypes.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {selectedAuthType && validAuthTypes.length > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToChooser}
                  className="h-6 w-6 p-0"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <span>{title || <Trans>Sign field</Trans>}</span>
              </div>
            )}
            {(!selectedAuthType || validAuthTypes.length === 1) &&
              (title || <Trans>Sign field</Trans>)}
          </DialogTitle>

          <DialogDescription>
            {description || <Trans>Reauthentication is required to sign this field</Trans>}
          </DialogDescription>
        </DialogHeader>

        {/* Show chooser if no auth type is selected and there are multiple options */}
        {!selectedAuthType && validAuthTypes.length > 1 && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              <Trans>Choose your preferred authentication method:</Trans>
            </p>
            <div className="grid gap-2">
              {validAuthTypes.map((authType) => (
                <Button
                  key={authType}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start p-4"
                  onClick={() => setSelectedAuthType(authType)}
                >
                  <div className="text-left">
                    <div className="font-medium">
                      {match(authType)
                        .with(DocumentAuth.ACCOUNT, () => <Trans>Account</Trans>)
                        .with(DocumentAuth.PASSKEY, () => <Trans>Passkey</Trans>)
                        .with(DocumentAuth.TWO_FACTOR_AUTH, () => <Trans>2FA</Trans>)
                        .with(DocumentAuth.PASSWORD, () => <Trans>Password</Trans>)
                        .exhaustive()}
                    </div>

                    <div className="text-muted-foreground text-sm">
                      {match(authType)
                        .with(DocumentAuth.ACCOUNT, () => <Trans>Sign in to your account</Trans>)
                        .with(DocumentAuth.PASSKEY, () => (
                          <Trans>Use your passkey for authentication</Trans>
                        ))
                        .with(DocumentAuth.TWO_FACTOR_AUTH, () => (
                          <Trans>Enter your 2FA code</Trans>
                        ))
                        .with(DocumentAuth.PASSWORD, () => <Trans>Enter your password</Trans>)
                        .exhaustive()}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Show the selected auth component */}
        {selectedAuthType &&
          match({ documentAuthType: selectedAuthType, user })
            .with(
              { documentAuthType: DocumentAuth.ACCOUNT },
              {
                user: P.when(
                  (user) => !user || (user.email !== recipient.email && !isDirectTemplate),
                ),
              }, // Assume all current auth methods requires them to be logged in.
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
            .with({ documentAuthType: DocumentAuth.PASSWORD }, () => (
              <DocumentSigningAuthPassword
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
