// POST to create
import { PrismaClient } from "@documenso/prisma";
import { User } from "@documenso/prisma";

import type { NextApiRequest, NextApiResponse } from "next";
import { json } from "stream/consumers";

export default async function userHandler(
  req: NextApiRequest,
  res: NextApiResponse<User>
) {
  const { method, body } = req;
  const prisma = new PrismaClient();

  switch (method) {
    case "POST":
      if (!body.email) {
        res.status(400).end("Email cannot be empty.");
      }

      try {
        let newUser: any;
        newUser = await prisma.user
          .create({
            data: { email: body.email },
          })
          .then(async () => {
            await prisma.$disconnect();
            res.status(200).send(newUser);
          });
      } catch (error) {
        await prisma.$disconnect();
        res.status(500).end("An error has occured. Error: " + error);
      }

      break;

    default:
      res.setHeader("Allow", ["POST"]);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
