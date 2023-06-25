import { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";
import { NextRequest } from "next/server";
import prisma from "@documenso/prisma";
import { User as PrismaUser } from "@prisma/client";
import { getToken } from "next-auth/jwt";

export async function getUserFromToken(
  req: GetServerSidePropsContext["req"] | NextRequest | NextApiRequest,
  res?: NextApiResponse // TODO: Remove this optional parameter
): Promise<PrismaUser | null> {
  const token = await getToken({ req });
  const tokenEmail = token?.email?.toString();

  if (!token || !tokenEmail) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { email: tokenEmail },
  });

  if (!user) {
    return null;
  }

  return user;
}
