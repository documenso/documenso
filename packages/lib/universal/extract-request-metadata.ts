import type { NextApiRequest } from 'next';

import type { RequestInternal } from 'next-auth';
import { z } from 'zod';

const ZIpSchema = z.string().ip();

export type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

export const extractNextApiRequestMetadata = (req: NextApiRequest): RequestMetadata => {
  const parsedIp = ZIpSchema.safeParse(req.headers['x-forwarded-for'] || req.socket.remoteAddress);

  const ipAddress = parsedIp.success ? parsedIp.data : undefined;
  const userAgent = req.headers['user-agent'];

  return {
    ipAddress,
    userAgent,
  };
};

export const extractNextAuthRequestMetadata = (
  req: Pick<RequestInternal, 'body' | 'query' | 'headers' | 'method'>,
): RequestMetadata => {
  return extractNextHeaderRequestMetadata(req.headers ?? {});
};

export const extractNextHeaderRequestMetadata = (
  headers: Record<string, string>,
): RequestMetadata => {
  const parsedIp = ZIpSchema.safeParse(headers?.['x-forwarded-for']);

  const ipAddress = parsedIp.success ? parsedIp.data : undefined;
  const userAgent = headers?.['user-agent'];

  return {
    ipAddress,
    userAgent,
  };
};
