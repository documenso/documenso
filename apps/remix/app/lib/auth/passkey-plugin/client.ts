import type { BetterAuthClientPlugin } from 'better-auth';

import type { passkeyPlugin } from './index';

type PasskeyPlugin = typeof passkeyPlugin;

export const passkeyClientPlugin = () => {
  const passkeySignin = () => {
    //
    // credential: JSON.stringify(credential),
    // callbackUrl,
  };

  return {
    id: 'passkeyPlugin',
    getActions: () => ({
      signIn: {
        passkey: () => passkeySignin,
      },
    }),
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    $InferServerPlugin: {} as ReturnType<PasskeyPlugin>,
  } satisfies BetterAuthClientPlugin;
};
