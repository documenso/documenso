import { useState } from 'react';

import { DateTime } from 'luxon';
import { signOut } from 'next-auth/react';

import { RecipientRole } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
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

  const [isSigningOut, setIsSigningOut] = useState(false);

  const { mutateAsync: encryptSecondaryData } = trpc.crypto.encryptSecondaryData.useMutation();

  const handleChangeAccount = async (email: string) => {
    try {
      setIsSigningOut(true);

      const encryptedEmail = await encryptSecondaryData({
        data: email,
        expiresAt: DateTime.now().plus({ days: 1 }).toMillis(),
      });

      await signOut({
        callbackUrl: `/signin?email=${encodeURIComponent(encryptedEmail)}`,
      });
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
              To mark this document as viewed, you need to be logged in as{' '}
              <strong>{recipient.email}</strong>
            </span>
          ) : (
            <span>
              To {actionVerb.toLowerCase()} this {actionTarget.toLowerCase()}, you need to be logged
              in as <strong>{recipient.email}</strong>
            </span>
          )}
        </AlertDescription>
      </Alert>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>

        <Button onClick={async () => handleChangeAccount(recipient.email)} loading={isSigningOut}>
          Login
        </Button>
      </DialogFooter>
    </fieldset>
  );
};
