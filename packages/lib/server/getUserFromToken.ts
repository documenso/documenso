import prisma from "@documenso/prisma";
import { User as PrismaUser } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { signOut } from "next-auth/react";

export async function getUserFromToken(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<PrismaUser | null> {
  const token = await getToken({ req });
  const tokenEmail = token?.email?.toString();

  if (!token) {
    res.status(401).send("No session token found for request.");
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
    res.status(401).end();
    return null;
  }

  return user;
}
