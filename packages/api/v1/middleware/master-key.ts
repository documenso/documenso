import type { TsRestRequest } from '@ts-rest/serverless';

import { SUITEOP_MASTER_KEY } from '@documenso/lib/constants/app';

type B = {
  request: TsRestRequest;
  responseHeaders: Headers;
};

export const masterKeyMiddleware = <
  T extends {
    headers: {
      authorization?: string;
      'x-suiteop-master-key'?: string;
    };
  },
  R extends {
    status: number;
    body: unknown;
  },
>(
  handler: (args: T & { req: TsRestRequest }) => Promise<R>,
) => {
  return async (args: T, { request }: B) => {
    const masterKey =
      args.headers['x-suiteop-master-key'] ||
      args.headers.authorization?.replace('Bearer ', '').replace('bearer ', '');

    if (!masterKey || masterKey !== SUITEOP_MASTER_KEY) {
      return {
        status: 401,
        body: {
          message: 'Invalid master key',
        },
      } as const;
    }

    if (!SUITEOP_MASTER_KEY) {
      return {
        status: 500,
        body: {
          message: 'Master key not configured',
        },
      } as const;
    }

    return await handler({
      ...args,
      req: request,
    });
  };
};
