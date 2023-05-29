import type { NextApiRequest, NextApiResponse } from "next";
import { hashPassword } from "@documenso/lib/auth";
import { defaultHandler, defaultResponder, getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { method, body } = req;

  if (!body.email) {
    return res.status(400).json({ message: "Email cannot be empty." });
  }

  let newUser: any;
  newUser = await prisma.user
    .create({
      data: { email: body.email },
    })
    .then(async () => {
      return res.status(201).send(newUser);
    });
}

async function patchHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getUserFromToken(req, res);
  if (!user) return;

  const updatedUser = req.body;

  let password: string | undefined = undefined;

  if (typeof updatedUser.password === "string" && updatedUser.password.length >= 6) {
    password = await hashPassword(updatedUser.password);
  }

  await prisma.user
    .update({
      where: {
        id: user.id,
      },
      data: {
        name: updatedUser.name,
        password,
      },
    })
    .then(() => {
      return res.status(200).end();
    });
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
  PATCH: Promise.resolve({ default: defaultResponder(patchHandler) }),
});
