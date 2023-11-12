'use client';

import { useState } from 'react';

import { useParams } from 'next/navigation';

import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
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
  const locale = useParams()?.locale as LocaleTypes;

  const { t } = useTranslation(locale, 'dashboard');
  return (
    <>
      <CardHeader>
        <CardTitle>{t(`recovery-options`)}</CardTitle>
      </CardHeader>

      <CardContent>
        <hr />
        <div className="flex items-center justify-between pt-4">
          <h4>{t(`recovery-codes`)}</h4>

          <Button
            disabled={!isTwoFactorEnabled}
            onClick={() => {
              setModalState('password');
            }}
            size="sm"
          >
            {t(`view`)}
          </Button>
        </div>

        <div className="flex pt-2">
          <CardDescription>{t(`in-case`)}</CardDescription>
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
        title={t(`view-recovery-code`)}
      />

      <RecoveryCodesDialog
        locale={locale}
        open={modalState === 'recover-codes'}
        onOpenChange={() => {
          setModalState(null);
        }}
        backupCodes={backupCodes}
      />
    </>
  );
};
