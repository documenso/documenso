import { useState } from 'react';

import { Trans } from '@lingui/macro';
import { RecipientRole } from '@prisma/client';
import { useNavigate } from 'react-router';

import { authClient } from '@documenso/auth/client';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { DialogFooter } from '@documenso/ui/primitives/dialog';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningAuthAccountProps = {
  actionTarget?: 'FIELD' | 'DOCUMENT';
  actionVerb?: string;
  onOpenChange: (value: boolean) => void;
};

export const DocumentSigningAuthAccount = ({
  actionTarget = 'FIELD',
  actionVerb = 'sign',
  onOpenChange,
}: DocumentSigningAuthAccountProps) => {
  const { recipient } = useRequiredDocumentSigningAuthContext();

  const navigate = useNavigate();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleChangeAccount = async (email: string) => {
    try {
      setIsSigningOut(true);

      // Todo
      await authClient.signOut();
      // {
      //   // redirect: false,
      //   // Todo: Redirect to signin like below
      // }

      await navigate(`/signin#email=${email}`);
    } catch {
      setIsSigningOut(false);

      // Todo: Alert.
    }
  };

  return (
    <fieldset disabled={isSigningOut} className="space-y-4">
      <Alert variant="warning">
        <AlertDescription>
          {actionTarget === 'DOCUMENT' && recipient.role === RecipientRole.VIEWER ? (
            <span>
              <Trans>
                To mark this document as viewed, you need to be logged in as{' '}
                <strong>{recipient.email}</strong>
              </Trans>
            </span>
          ) : (
            <span>
              {/* Todo: Translate */}
              To {actionVerb.toLowerCase()} this {actionTarget.toLowerCase()}, you need to be logged
              in as <strong>{recipient.email}</strong>
            </span>
          )}
        </AlertDescription>
      </Alert>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          <Trans>Cancel</Trans>
        </Button>

        <Button onClick={async () => handleChangeAccount(recipient.email)} loading={isSigningOut}>
          <Trans>Login</Trans>
        </Button>
      </DialogFooter>
    </fieldset>
  );
};
