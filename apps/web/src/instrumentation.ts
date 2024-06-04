import { registerInstance } from '@documenso/lib/server-only/telemetry/register-instance';

import packageInfo from '../package.json';

export const register = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await registerInstance({ version: packageInfo.version });
  }
};
