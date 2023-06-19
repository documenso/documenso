import { NextApiRequest, NextApiResponse } from "next";
import { setCopiedField } from "@documenso/lib/copied";
import { defaultHandler, defaultResponder, getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { SendStatus } from "@prisma/client";

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getUserFromToken(req, res);
  const { id: recipientId } = req.query;

  if (!user) {
    return res.status(401).send("Unauthorized");
  }

  if (!recipientId) {
    return res.status(400).send("Missing parameter recipientId.");
  }

  const recipients = await prisma.recipient.findMany({
    where: {
      id: +recipientId,
    },
  });

  if (!recipients.length) {
    return res.status(200).send(recipients.length);
  }

  try {
    await prisma.$transaction(
      recipients.map((recipient) => {
        return prisma.recipient.update({
          where: {
            id: recipient.id,
          },
          data: {
            sendStatus: SendStatus.LINK_COPIED,
          },
        });
      })
    );
  } catch (err) {
    console.log(err);
    return res.status(502).end("Could not send request for copying link.");
  }
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
});
