import prisma from "@documenso/prisma";
import { User as PrismaUser } from "@prisma/client";
import { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";

export async function getUserFromToken(
  req: NextApiRequest | GetServerSidePropsContext['req'],
  res: NextApiResponse | GetServerSidePropsContext['res']
): Promise<PrismaUser | null> {
  const token = await getToken({ req });
  const tokenEmail = token?.email?.toString();

  if (!token) {
    if ('status' in res) {
      res.status(401).send("No session token found for request.")
    };

    return null;
  }

  if (!tokenEmail) {
    if ('status' in res) {
      res.status(400).send("No email found in session token.");
    }

    return null;
  }

  const user = await prisma.user.findFirst({
    where: { email: tokenEmail },
  });

  if (!user) {
    if ('status' in res) {
      res.status(401).end();
    }

    return null;
  }

  return user;
}
