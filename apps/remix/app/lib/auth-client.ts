import { twoFactor } from 'better-auth/plugins';
import { createAuthClient } from 'better-auth/react';

import { passkeyClientPlugin } from './auth/passkey-plugin/client';

// make sure to import from better-auth/react

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3000',
  plugins: [twoFactor(), passkeyClientPlugin()],
});

export const { signIn, signOut, useSession } = authClient;
