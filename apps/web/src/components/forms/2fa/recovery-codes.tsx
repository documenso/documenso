'use client';

import { useState } from 'react';

import { Button } from '@documenso/ui/primitives/button';

import { ViewRecoveryCodesDialog } from './view-recovery-codes-dialog';

type RecoveryCodesProps = {
  isTwoFactorEnabled: boolean;
};

export const RecoveryCodes = ({ isTwoFactorEnabled }: RecoveryCodesProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        className="flex-shrink-0"
        onClick={() => setIsOpen(true)}
        disabled={!isTwoFactorEnabled}
      >
        View Codes
      </Button>

      <ViewRecoveryCodesDialog
        key={isOpen ? 'open' : 'closed'}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
};
