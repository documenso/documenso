import { adminRouter } from './admin-router/router';
import { authRouter } from './auth-router/router';
import { documentRouter } from './document-router/router';
import { fieldRouter } from './field-router/router';
import { profileRouter } from './profile-router/router';
import { procedure, router } from './trpc';

export const appRouter = router({
  hello: procedure.query(() => 'Hello, world!'),
  auth: authRouter,
  profile: profileRouter,
  document: documentRouter,
  field: fieldRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
