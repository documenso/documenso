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
      <div className="mt-4 flex flex-col justify-between gap-4 rounded-lg border p-4 md:flex-row md:items-center md:gap-8">
        <div className="flex-1">
          <p>Authenticator app</p>

          <p className="text-muted-foreground mt-2 max-w-[50ch] text-sm">
            Create one-time passwords that serve as a secondary authentication method for confirming
            your identity when requested during the sign-in process.
          </p>
        </div>

        <div>
          {isTwoFactorEnabled ? (
            <Button variant="destructive" onClick={() => setModalState('disable')} size="sm">
              Disable 2FA
            </Button>
          ) : (
            <Button onClick={() => setModalState('enable')} size="sm">
              Enable 2FA
            </Button>
          )}
        </div>
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
