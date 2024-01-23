import { adminRouter } from './admin-router/router';
import { authRouter } from './auth-router/router';
import { documentRouter } from './document-router/router';
import { fieldRouter } from './field-router/router';
import { profileRouter } from './profile-router/router';
import { recipientRouter } from './recipient-router/router';
import { shareLinkRouter } from './share-link-router/router';
import { singleplayerRouter } from './singleplayer-router/router';
import { templateRouter } from './template-router/router';
import { router } from './trpc';
import { twoFactorAuthenticationRouter } from './two-factor-authentication-router/router';

export const appRouter = router({
  auth: authRouter,
  profile: profileRouter,
  document: documentRouter,
  field: fieldRouter,
  recipient: recipientRouter,
  admin: adminRouter,
  shareLink: shareLinkRouter,
  singleplayer: singleplayerRouter,
  twoFactorAuthentication: twoFactorAuthenticationRouter,
  template: templateRouter,
});

export type AppRouter = typeof appRouter;
