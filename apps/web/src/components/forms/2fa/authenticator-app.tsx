'use client';

import { useState } from 'react';

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

  return (
    <>
      <div className="flex-shrink-0">
        {isTwoFactorEnabled ? (
          <Button variant="destructive" onClick={() => setModalState('disable')}>
            Disable 2FA
          </Button>
        ) : (
          <Button onClick={() => setModalState('enable')}>Enable 2FA</Button>
        )}
      </div>

      <EnableAuthenticatorAppDialog
        open={isEnableDialogOpen}
        onOpenChange={(open) => !open && setModalState(null)}
      />

      <DisableAuthenticatorAppDialog
        open={isDisableDialogOpen}
        onOpenChange={(open) => !open && setModalState(null)}
      />
    </>
  );
};
