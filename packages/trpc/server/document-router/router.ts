import { TRPCError } from '@trpc/server';

import { sendMail } from '@documenso/lib/server-only/document/send-document';

import { authenticatedProcedure, router } from '../trpc';
import { ZSendMailMutationSchema } from './schema';

export const documentRouter = router({
  sendEmail: authenticatedProcedure
    .input(ZSendMailMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { email } = input;

        console.log('Send Mail Context', ctx);
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
