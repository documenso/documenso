import { defaultHandler, defaultResponder } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { useSession } from "next-auth/react";
import { buffer } from "stream/consumers";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  // todo move token validation to import
  const token = await getToken({ req });
  const tokenEmail = token?.email?.toString();
  if (!token) {
    res.status(401).end();
  }

  let user = await prisma.user.findFirst({
    where: { email: tokenEmail },
  });

  if (!user) {
    res.status(401).end();
  } else {
    let newDocument: any;
    newDocument = await prisma.document
      .create({
        data: {
          userId: user?.id,
        },
      })
      .then(async () => {
        return res.status(201).end();
      });
  }
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  const tokenEmail = token?.email?.toString();
  if (!token) {
    res.status(401).end();
  }

  let user = await prisma.user.findFirst({
    where: { email: tokenEmail },
  });

  return res
    .status(200)
    .json(await prisma.document.findMany({ where: { userId: user?.id } }));
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
