import { findComments } from '@documenso/lib/server-only/comment/find-comments';

import { procedure, router } from '../trpc';

export const commentRouter = router({
  getComments: procedure.query(async () => {
    return await findComments();
  }),
});
