import { getUserByApiToken } from '@documenso/lib/server-only/public-api/get-user-by-token';

export type Headers = {
  headers: {
    authorization: string;
  };
};

export const authenticatedMiddleware = <T extends Headers>(fn: (args: T) => Promise<any>) => {
  return async (args: T) => {
    if (!args.headers.authorization) {
      return {
        status: 401,
        body: {
          message: 'Unauthorized access',
        },
      };
    }

    try {
      await getUserByApiToken({ token: args.headers.authorization });
    } catch (err) {
      return {
        status: 401,
        body: {
          message: 'Unauthorized access',
        },
      };
    }

    return fn(args);
  };
};
