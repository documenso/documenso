'use client';

import { useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import { trpc } from '@documenso/trpc/react';
import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
import { Button } from '@documenso/ui/primitives/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@documenso/ui/primitives/card';

import { AuthenticatorAppDisableDialog } from './authenticator-app-disable-dialog';
import { AuthenticatorAppSetupDialog } from './authenticator-app-setup-dialog';
import { PasswordCheckDialog } from './password-check-dialog';
import { RecoveryCodesDialog } from './recovery-codes-dialog';

type ModalState = null | 'password-check' | 'disable-2fa' | 'setup-2fa' | 'backup-codes';

type AuthenticatorAppProps = {
  isTwoFactorEnabled: boolean;
  backupCodes: string[] | null;
};

export const AuthenticatorApp = ({ isTwoFactorEnabled, backupCodes }: AuthenticatorAppProps) => {
  const locale = useParams()?.locale as LocaleTypes;

  const router = useRouter();
  const { mutateAsync: setup } = trpc.twoFactor.setup.useMutation();
  const [modalState, setModalState] = useState<ModalState>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof setup>> | null>(null);
  const { t } = useTranslation(locale, 'dashboard');
  const handleVerified = async (password: string) => {
    try {
      const data = await setup({ password });
      setData(data);
      setModalState('setup-2fa');
    } catch (error) {
      console.error(error);
    }
  };

  const handleDisabled = () => {
    setModalState(null);
    setData(null);
    router.refresh();
  };

  const onSetupComplete = () => {
    setData(null);
    router.refresh();
    setModalState('backup-codes');
  };

  return (
    <>
      <CardHeader>
        <CardTitle>{t(`2fa-methods`)}</CardTitle>
      </CardHeader>
      <CardContent>
        <hr />
        <div className="flex items-center justify-between pt-4">
          <h4>{t('authenticator-app')}</h4>

          <Button
            onClick={() => {
              setModalState(isTwoFactorEnabled ? 'disable-2fa' : 'password-check');
            }}
            size="sm"
            variant={isTwoFactorEnabled ? 'destructive' : 'default'}
          >
            {isTwoFactorEnabled ? 'disable' : 'enable'}
          </Button>
        </div>

        <div className="flex pt-2">
          <CardDescription>{t('create-one-tine-password')}</CardDescription>
        </div>
      </CardContent>

      <PasswordCheckDialog
        open={modalState === 'password-check'}
        onOpenChange={() => setModalState(null)}
        title="Enable two-factor authentication"
        onVerified={handleVerified}
      />

      <AuthenticatorAppSetupDialog
        locale={locale}
        open={modalState === 'setup-2fa'}
        onOpenChange={() => setModalState(null)}
        onSetupComplete={onSetupComplete}
        qr={data?.qr}
        secret={data?.secret}
      />

      <RecoveryCodesDialog
        locale={locale}
        backupCodes={backupCodes}
        onOpenChange={() => setModalState(null)}
        open={modalState === 'backup-codes'}
      />

      <AuthenticatorAppDisableDialog
        open={modalState === 'disable-2fa'}
        onOpenChange={() => setModalState(null)}
        onDisabled={handleDisabled}
      />
    </>
  );
};
