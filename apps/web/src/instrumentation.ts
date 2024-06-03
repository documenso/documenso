import { registerInstance } from '@documenso/lib/server-only/telemetry/register-instance';

export const register = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await registerInstance();
  }
};
