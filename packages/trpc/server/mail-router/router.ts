import { TRPCError } from '@trpc/server';

import { sendMail } from '@documenso/lib/server-only/mail/send';

import { authenticatedProcedure, router } from '../trpc';
import { ZSendMailMutationSchema } from './schema';

export const mailRouter = router({
  send: authenticatedProcedure.input(ZSendMailMutationSchema).mutation(async ({ input }) => {
    try {
      const { email } = input;

      return await sendMail({ email });
    } catch (err) {
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to send an email.',
      });
    }
  }),
});
