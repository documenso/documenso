import prisma from "@documenso/prisma";
import { User as PrismaUser } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";

export async function getUserFromToken(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<PrismaUser | null> {
  const token = await getToken({ req });
  const tokenEmail = token?.email?.toString();

  if (!token) {
    res.status(401).send("No token found for request.");
    return null;
  }

  if (!tokenEmail) {
    res.status(400).send("No email found in token.");
    return null;
  }

  let user = await prisma.user.findFirstOrThrow({
    where: { email: tokenEmail },
  });

  if (user) return user;
  if (!user) res.status(401).send("No user found for token.");
  return null;
}
