import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@documenso/prisma";
import { authOptions } from "../../../apps/web/pages/api/auth/[...nextauth]";
import { User as PrismaUser } from "@prisma/client";
import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth/next";

export async function getUserFromToken(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<PrismaUser | null> {
  const oauthUser = await getServerSession(req, res, authOptions);

  if (oauthUser) {
    return oauthUser.user as PrismaUser;
  }

  const token = await getToken({ req });
  const tokenEmail = token?.email?.toString();

  if (!token) {
    if (res.status) res.status(401).send("No session token found for request.");
    return null;
  }

  if (!tokenEmail) {
    res.status(400).send("No email found in session token.");
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { email: tokenEmail },
  });

  if (!user) {
    if (res && res.status) res.status(401).end();
    return null;
  }

  return user;
}
