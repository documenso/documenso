import { adminRouter } from './admin-router/router';
<<<<<<< HEAD
import { authRouter } from './auth-router/router';
import { documentRouter } from './document-router/router';
import { fieldRouter } from './field-router/router';
import { profileRouter } from './profile-router/router';
import { shareLinkRouter } from './share-link-router/router';
import { procedure, router } from './trpc';

export const appRouter = router({
  health: procedure.query(() => {
    return { status: 'ok' };
  }),
  auth: authRouter,
  profile: profileRouter,
  document: documentRouter,
  field: fieldRouter,
  admin: adminRouter,
  shareLink: shareLinkRouter,
=======
import { apiTokenRouter } from './api-token-router/router';
import { authRouter } from './auth-router/router';
import { cryptoRouter } from './crypto/router';
import { documentRouter } from './document-router/router';
import { fieldRouter } from './field-router/router';
import { profileRouter } from './profile-router/router';
import { recipientRouter } from './recipient-router/router';
import { shareLinkRouter } from './share-link-router/router';
import { singleplayerRouter } from './singleplayer-router/router';
import { teamRouter } from './team-router/router';
import { templateRouter } from './template-router/router';
import { router } from './trpc';
import { twoFactorAuthenticationRouter } from './two-factor-authentication-router/router';
import { webhookRouter } from './webhook-router/router';

export const appRouter = router({
  auth: authRouter,
  crypto: cryptoRouter,
  profile: profileRouter,
  document: documentRouter,
  field: fieldRouter,
  recipient: recipientRouter,
  admin: adminRouter,
  shareLink: shareLinkRouter,
  apiToken: apiTokenRouter,
  singleplayer: singleplayerRouter,
  team: teamRouter,
  template: templateRouter,
  webhook: webhookRouter,
  twoFactorAuthentication: twoFactorAuthenticationRouter,
>>>>>>> main
});

export type AppRouter = typeof appRouter;
