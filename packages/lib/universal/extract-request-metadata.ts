import type { NextApiRequest } from 'next';

import type { RequestInternal } from 'next-auth';
import { z } from 'zod';

const ZIpSchema = z.string().ip();

export const ZRequestMetadataSchema = z.object({
  ipAddress: ZIpSchema.optional(),
  userAgent: z.string().optional(),
});

export type RequestMetadata = z.infer<typeof ZRequestMetadataSchema>;

export type ApiRequestMetadata = {
  /**
   * The general metadata of the request.
   */
  requestMetadata: RequestMetadata;

  /**
   * The source of the request.
   */
  source: 'apiV1' | 'apiV2' | 'app';

  /**
   * The method of authentication used to access the API.
   *
   * If the request is not authenticated, the value will be `null`.
   */
  auth: 'api' | 'session' | null;

  /**
   * The user that is performing the action.
   *
   * If a team API key is used, the user will classified as the team.
   */
  auditUser?: {
    id: number | null;
    email: string | null;
    name: string | null;
  };
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
