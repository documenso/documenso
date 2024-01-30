import type { NextApiRequest } from 'next';

import { z } from 'zod';

const ZIpSchema = z.string().ip();

export type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

export const extractRequestMetadata = (req: NextApiRequest): RequestMetadata => {
  const parsedIp = ZIpSchema.safeParse(req.headers['x-forwarded-for'] || req.socket.remoteAddress);

  const ipAddress = parsedIp.success ? parsedIp.data : undefined;
  const userAgent = req.headers['user-agent'];

  return {
    ipAddress,
    userAgent,
  };
};
