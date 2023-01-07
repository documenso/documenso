import { PrismaClient } from "@documenso/prisma";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function userHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method, body } = req;
  const prisma = new PrismaClient();

  // Check Session

  switch (method) {
    case "POST":
      if (!body.userId) {
        res.status(400).end("Owner ID cannot be empty.");
      }

      try {
        const newDocument: any = await prisma.document
          .create({
            data: { userId: body.userId, document: body.document },
          })
          .then(async () => {
            await prisma.$disconnect();
            res.status(200).send(newDocument);
          });
      } catch (error) {
        await prisma.$disconnect();
        res.status(500).end("An error has occured.");
      }

      break;

    case "GET":
      // GET all docs for user in session
      let documents = await prisma.document.findMany({
        where: {
          userId: body.userId,
        },
      });
      res.status(200).send(documents);
      break;

    default:
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
