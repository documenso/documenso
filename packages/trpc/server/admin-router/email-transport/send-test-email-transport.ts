import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { resolveEmailTransport } from '@documenso/lib/server-only/email/resolve-email-transport';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import {
  ZSendTestEmailTransportRequestSchema,
  ZSendTestEmailTransportResponseSchema,
} from './send-test-email-transport.types';

export const sendTestEmailTransportRoute = adminProcedure
  .input(ZSendTestEmailTransportRequestSchema)
  .output(ZSendTestEmailTransportResponseSchema)
  .mutation(async ({ input, ctx }) => {
    ctx.logger.info({
      input: {
        id: input.id,
      },
    });

    const transport = await prisma.emailTransport.findUnique({
      where: {
        id: input.id,
      },
    });

    if (!transport) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Email transport not found' });
    }

    const resolved = await resolveEmailTransport(input.id);

    if (!resolved) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to build transport from stored configuration.',
      });
    }

    try {
      await resolved.transporter.sendMail({
        to: input.to,
        from: { name: transport.fromName, address: transport.fromAddress },
        subject: 'Documenso email transport test',
        text: `This is a test email sent through the "${transport.name}" email transport.`,
      });
    } catch (err) {
      throw AppError.parseError(err);
    }
  });
