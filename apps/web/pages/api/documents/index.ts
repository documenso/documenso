import { defaultHandler, defaultResponder } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { NextApiRequest, NextApiResponse } from "next";
import { getUserFromToken } from "@documenso/lib/server";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  let user = await getUserFromToken(req, res);
  if (!user) return;

  await prisma.document
    .create({
      data: {
        userId: user?.id,
      },
    })
    .then(async () => {
      return res.status(201).end();
    });
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  let user = await getUserFromToken(req, res);
  if (!user) return;

  return res
    .status(200)
    .json(await prisma.document.findMany({ where: { userId: user?.id } }));
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
