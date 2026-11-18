import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  decryptEmailTransportConfig,
  EMAIL_TRANSPORT_SECRET_KEYS,
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
    // config (only when the type is unchanged).
    const merged: Record<string, unknown> = { ...data.config };

    if (existingConfig.type === data.config.type) {
      for (const key of EMAIL_TRANSPORT_SECRET_KEYS) {
        const incoming = (data.config as Record<string, unknown>)[key];
        if (incoming === undefined || incoming === '') {
          merged[key] = (existingConfig as Record<string, unknown>)[key];
        }
      }
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
