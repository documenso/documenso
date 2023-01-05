import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

type Data = {
  status: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const prisma = new PrismaClient();

  const user = await prisma.user.create({
    data: {
      email: "m@ouse.de",
      name: "Mickey Mouse",
    },
  });

  res.status(200).json({ status: "User created" });
}
