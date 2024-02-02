import type { CreateNextContextOptions } from '@trpc/server/adapters/next';

import { getServerSession } from '@documenso/lib/next-auth/get-server-session';

export const createTrpcContext = async ({ req, res }: CreateNextContextOptions) => {
  const { session, user } = await getServerSession({ req, res });

  if (!session) {
    return {
      session: null,
      user: null,
      req,
    };
  }

  if (!user) {
    return {
      session: null,
      user: null,
      req,
    };
  }

  return {
    session,
    user,
    req,
  };
};

export type TrpcContext = Awaited<ReturnType<typeof createTrpcContext>>;
