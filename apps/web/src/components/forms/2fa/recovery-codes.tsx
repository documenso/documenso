'use client';

import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Button } from '@documenso/ui/primitives/button';

import { ViewRecoveryCodesDialog } from './view-recovery-codes-dialog';

type RecoveryCodesProps = {
  isTwoFactorEnabled: boolean;
};

export const RecoveryCodes = ({ isTwoFactorEnabled }: RecoveryCodesProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <Button
        className="flex-shrink-0"
        onClick={() => setIsOpen(true)}
        disabled={!isTwoFactorEnabled}
      >
        {t('view_codes')}
      </Button>

      <ViewRecoveryCodesDialog
        key={isOpen ? 'open' : 'closed'}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
};
