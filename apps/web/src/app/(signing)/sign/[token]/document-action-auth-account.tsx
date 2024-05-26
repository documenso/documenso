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
  actionVerb = 'ხელი მოაწეროთ',
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
              ეს დოკუმენტის ნანახად, რომ მოინიშნოს, თქვენ უნდა იყოთ ავტორიზებული, როგორც{' '}
              <strong>{recipient.email}</strong>
            </span>
          ) : (
            <span>
              თუ გნებავთ, რომ {actionVerb} {actionTarget.toLowerCase()}-ს, თქვენ უნდა იყოთ
              ავტორიზებული, როგორც <strong>{recipient.email}</strong>
            </span>
          )}
        </AlertDescription>
      </Alert>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          დახურვა
        </Button>

        <Button onClick={async () => handleChangeAccount(recipient.email)} loading={isSigningOut}>
          ავტორიზაცია
        </Button>
      </DialogFooter>
    </fieldset>
  );
};
