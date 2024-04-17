<<<<<<< HEAD
import { CreateNextContextOptions } from '@trpc/server/adapters/next';
=======
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';
>>>>>>> main

import { getServerSession } from '@documenso/lib/next-auth/get-server-session';

export const createTrpcContext = async ({ req, res }: CreateNextContextOptions) => {
  const { session, user } = await getServerSession({ req, res });

  if (!session) {
    return {
      session: null,
      user: null,
<<<<<<< HEAD
=======
      req,
>>>>>>> main
    };
  }

  if (!user) {
    return {
      session: null,
      user: null,
<<<<<<< HEAD
=======
      req,
>>>>>>> main
    };
  }

  return {
    session,
    user,
<<<<<<< HEAD
=======
    req,
>>>>>>> main
  };
};

export type TrpcContext = Awaited<ReturnType<typeof createTrpcContext>>;
