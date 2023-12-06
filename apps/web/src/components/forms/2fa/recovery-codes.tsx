'use client';

import { useState } from 'react';

import { Button } from '@documenso/ui/primitives/button';

import { ViewRecoveryCodesDialog } from './view-recovery-codes-dialog';

type RecoveryCodesProps = {
  // backupCodes: string[] | null;
  isTwoFactorEnabled: boolean;
};

export const RecoveryCodes = ({ isTwoFactorEnabled }: RecoveryCodesProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="mt-4 flex flex-col justify-between gap-4 rounded-lg border p-4 md:flex-row md:items-center md:gap-8">
        <div className="flex-1">
          <p>Recovery Codes</p>

          <p className="text-muted-foreground mt-2 max-w-[50ch] text-sm">
            Recovery codes are used to access your account in the event that you lose access to your
            authenticator app.
          </p>
        </div>

        <div>
          <Button onClick={() => setIsOpen(true)} disabled={!isTwoFactorEnabled} size="sm">
            View Codes
          </Button>
        </div>
      </div>

      <ViewRecoveryCodesDialog
        key={isOpen ? 'open' : 'closed'}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
};
