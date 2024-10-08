import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Trans } from '@lingui/macro';
import { signOut } from 'next-auth/react';

import { RecipientRole } from '@documenso/prisma/client';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { DialogFooter } from '@documenso/ui/primitives/dialog';

import { useRequiredDocumentAuthContext } from './document-auth-provider';

export type DocumentActionAuthAccountProps = {
  actionTarget?: 'FIELD' | 'DOCUMENT';
  actionVerb?: string;
  onOpenChange: (value: boolean) => void;
};

export const DocumentActionAuthAccount = ({
  actionTarget = 'FIELD',
  actionVerb = 'sign',
  onOpenChange,
}: DocumentActionAuthAccountProps) => {
  const { recipient } = useRequiredDocumentAuthContext();

  const router = useRouter();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleChangeAccount = async (email: string) => {
    try {
      setIsSigningOut(true);

      await signOut({
        redirect: false,
      });

      router.push(`/signin#email=${email}`);
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
