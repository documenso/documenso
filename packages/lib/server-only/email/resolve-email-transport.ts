import { buildTransport } from '@documenso/email/transports/build-transport';
import { prisma } from '@documenso/prisma';
import type { EmailTransport } from '@documenso/prisma/client';
import type { Transporter } from 'nodemailer';
import { logger } from '../../utils/logger';
import { decryptEmailTransportConfig } from './email-transport-config';

export type ResolvedEmailTransport = {
  row: EmailTransport;
  transporter: Transporter;
};

/**
 * Loads an EmailTransport row, decrypts its config and builds a nodemailer
 * Transporter. Returns null when the id does not resolve or the stored config
 * cannot be decrypted/built (caller should fall back to the env mailer).
 */
export const resolveEmailTransport = async (emailTransportId: string): Promise<ResolvedEmailTransport | null> => {
  const row = await prisma.emailTransport.findUnique({
    where: { id: emailTransportId },
  });

  if (!row) {
    return null;
  }

  try {
    const config = decryptEmailTransportConfig(row.config);
    const transporter = buildTransport(config);

    return { row, transporter };
  } catch (err) {
    // Todo: Logging
    logger.error({
      msg: 'Failed to decrypt or build the configured email transport',
      err,
      emailTransportId,
    });

    return null;
  }
};
