import { router } from '../trpc';
import { createPasskeyRoute } from './create-passkey';
import { createPasskeyAuthenticationOptionsRoute } from './create-passkey-authentication-options';
import { createPasskeyRegistrationOptionsRoute } from './create-passkey-registration-options';
import { createPasskeySigninOptionsRoute } from './create-passkey-signin-options';
import { deletePasskeyRoute } from './delete-passkey';
import { findPasskeysRoute } from './find-passkeys';
import { getAuthMethodsRoute } from './get-auth-methods';
import { updatePasskeyRoute } from './update-passkey';

export const authRouter = router({
  getAuthMethods: getAuthMethodsRoute,
  passkey: router({
    create: createPasskeyRoute,
    createAuthenticationOptions: createPasskeyAuthenticationOptionsRoute,
    createRegistrationOptions: createPasskeyRegistrationOptionsRoute,
    createSigninOptions: createPasskeySigninOptionsRoute,
    delete: deletePasskeyRoute,
    find: findPasskeysRoute,
    update: updatePasskeyRoute,
  }),
});
