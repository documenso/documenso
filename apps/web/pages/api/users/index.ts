// POST to create
import {
  defaultHandler,
  defaultResponder,
  HttpError,
} from "@documenso/lib/server";
import prisma from "@documenso/prisma";

import type { NextApiRequest, NextApiResponse } from "next";
import { json } from "stream/consumers";

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

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
