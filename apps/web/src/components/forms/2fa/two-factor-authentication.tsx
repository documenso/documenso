import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { getBackupCodes } from '@documenso/lib/server-only/2fa/get-backup-code';
import { Card } from '@documenso/ui/primitives/card';

import { AuthenticatorApp } from './authenticator-app';
import { RecoveryCodes } from './recovery-codes';

export const TwoFactorAuthenticationForm = async () => {
  const { user } = await getRequiredServerComponentSession();

  const backupCodes = getBackupCodes({ user });

  const isTwoFactorEnabled = user.twoFactorEnabled;
  return (
    <Card>
      <AuthenticatorApp isTwoFactorEnabled={isTwoFactorEnabled} backupCodes={backupCodes} />
      <hr />
      <RecoveryCodes isTwoFactorEnabled={isTwoFactorEnabled} backupCodes={backupCodes} />
    </Card>
  );
};
