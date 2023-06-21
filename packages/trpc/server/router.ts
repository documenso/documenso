import { authRouter } from './auth-router/router';
import { mailRouter } from './mail-router/router';
import { profileRouter } from './profile-router/router';
import { procedure, router } from './trpc';

export const appRouter = router({
  hello: procedure.query(() => 'Hello, world!'),
  auth: authRouter,
  profile: profileRouter,
  mail: mailRouter,
});

export type AppRouter = typeof appRouter;
