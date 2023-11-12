'use client';

import { useState } from 'react';

import { Button } from '@documenso/ui/primitives/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@documenso/ui/primitives/card';

import { PasswordCheckDialog } from './password-check-dialog';
import { RecoveryCodesDialog } from './recovery-codes-dialog';

type ModalState = null | 'password' | 'recover-codes';

type RecoveryCodesProps = {
  backupCodes: string[] | null;
  isTwoFactorEnabled: boolean;
};

export const RecoveryCodes = ({ backupCodes, isTwoFactorEnabled }: RecoveryCodesProps) => {
  const [modalState, setModalState] = useState<ModalState>(null);
  return (
    <>
      <CardHeader>
        <CardTitle>Recovery options</CardTitle>
      </CardHeader>

      <CardContent>
        <hr />
        <div className="flex items-center justify-between pt-4">
          <h4>Recovery codes</h4>

          <Button
            disabled={!isTwoFactorEnabled}
            onClick={() => {
              setModalState('password');
            }}
            size="sm"
          >
            View
          </Button>
        </div>

        <div className="flex pt-2">
          <CardDescription>
            In case you lose access to your device and are unable to receive two-factor
            authentication codes, recovery codes provide a means to access your account.
          </CardDescription>
        </div>
      </CardContent>

      <PasswordCheckDialog
        open={modalState === 'password'}
        onOpenChange={() => {
          setModalState(null);
        }}
        // eslint-disable-next-line @typescript-eslint/require-await
        onVerified={async () => {
          setModalState('recover-codes');
        }}
        title="View recovery code"
      />

      <RecoveryCodesDialog
        open={modalState === 'recover-codes'}
        onOpenChange={() => {
          setModalState(null);
        }}
        backupCodes={backupCodes}
      />
    </>
  );
};
