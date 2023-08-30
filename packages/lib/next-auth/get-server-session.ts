import { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

import { getServerSession as getNextAuthServerSession } from 'next-auth';

import { prisma } from '@documenso/prisma';

import { NEXT_AUTH_OPTIONS } from './auth-options';

export interface GetServerSessionOptions {
  req: NextApiRequest | GetServerSidePropsContext['req'];
  res: NextApiResponse | GetServerSidePropsContext['res'];
}

export const getServerSession = async ({ req, res }: GetServerSessionOptions) => {
  const session = await getNextAuthServerSession(req, res, NEXT_AUTH_OPTIONS);

  if (!session || !session.user?.email) {
    return null;
  }

  const user = await prisma.user.findFirstOrThrow({
    where: {
      email: session.user.email,
    },
  });

  return user;
};

export const getServerComponentSession = async () => {
  const session = await getNextAuthServerSession(NEXT_AUTH_OPTIONS);

  if (!session || !session.user?.email) {
    return null;
  }

  const user = await prisma.user.findFirstOrThrow({
    where: {
      email: session.user.email,
    },
  });

  return user;
};

export const getRequiredServerComponentSession = async () => {
  const session = await getServerComponentSession();

  if (!session) {
    throw new Error('No session found');
  }

  return session;
};
