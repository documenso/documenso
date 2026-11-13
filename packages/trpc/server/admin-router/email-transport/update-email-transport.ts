import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  decryptEmailTransportConfig,
  encryptEmailTransportConfig,
  ZEmailTransportConfigSchema,
} from '@documenso/lib/server-only/email/email-transport-config';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import {
  ZUpdateEmailTransportRequestSchema,
  ZUpdateEmailTransportResponseSchema,
} from './update-email-transport.types';

export const updateEmailTransportRoute = adminProcedure
  .input(ZUpdateEmailTransportRequestSchema)
  .output(ZUpdateEmailTransportResponseSchema)
  .mutation(async ({ input }) => {
    const { id, data } = input;

    const existing = await prisma.emailTransport.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Email transport not found' });
    }

    const existingConfig = decryptEmailTransportConfig(existing.config);

    // Start from the incoming config; backfill empty secret fields from the existing
    // config (only when the type is unchanged). Secrets are never sent back to the
    // client, so a blank incoming value means "keep the existing secret".
    const merged = { ...data.config };

    if (merged.type === 'SMTP_AUTH' && existingConfig.type === 'SMTP_AUTH' && !merged.password) {
      merged.password = existingConfig.password;
    }

    if (merged.type !== 'SMTP_AUTH' && merged.type === existingConfig.type && !merged.apiKey) {
      merged.apiKey = existingConfig.apiKey;
    }

    const config = ZEmailTransportConfigSchema.parse(merged);

    await prisma.emailTransport.update({
      where: { id },
      data: {
        name: data.name,
        type: config.type,
        fromName: data.fromName,
        fromAddress: data.fromAddress,
        config: encryptEmailTransportConfig(config),
      },
    });
  });
