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
});

export type AppRouter = typeof appRouter;
