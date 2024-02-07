'use client';

import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Button } from '@documenso/ui/primitives/button';

import { DisableAuthenticatorAppDialog } from './disable-authenticator-app-dialog';
import { EnableAuthenticatorAppDialog } from './enable-authenticator-app-dialog';

type AuthenticatorAppProps = {
  isTwoFactorEnabled: boolean;
};

export const AuthenticatorApp = ({ isTwoFactorEnabled }: AuthenticatorAppProps) => {
  const [modalState, setModalState] = useState<'enable' | 'disable' | null>(null);

  const isEnableDialogOpen = modalState === 'enable';
  const isDisableDialogOpen = modalState === 'disable';
  const { t } = useTranslation();

  return (
    <>
      <div className="flex-shrink-0">
        {isTwoFactorEnabled ? (
          <Button variant="destructive" onClick={() => setModalState('disable')}>
            {t('disable_2FA')}
          </Button>
        ) : (
          <Button onClick={() => setModalState('enable')}>{t('enable_2FA')}</Button>
        )}
      </div>

      <EnableAuthenticatorAppDialog
        key={isEnableDialogOpen ? 'open' : 'closed'}
        open={isEnableDialogOpen}
        onOpenChange={(open) => !open && setModalState(null)}
      />

      <DisableAuthenticatorAppDialog
        key={isDisableDialogOpen ? 'open' : 'closed'}
        open={isDisableDialogOpen}
        onOpenChange={(open) => !open && setModalState(null)}
      />
    </>
  );
};
