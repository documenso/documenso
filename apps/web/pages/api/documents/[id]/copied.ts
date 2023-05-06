import { NextApiRequest, NextApiResponse } from "next";
import { setCopiedField } from "@documenso/lib/copied";
import { defaultHandler, defaultResponder, getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getUserFromToken(req, res);
  const { id: recipientId } = req.query;

  if (!user) return;

  if (!recipientId) {
    res.status(400).send("Missing parameter recipientId.");
    return;
  }

  const recipients = await prisma.recipient.findMany({
    where: {
      id: +recipientId,
    },
  });

  console.log("api/documenso/id/copied", recipients);

  if (!recipients.length) return res.status(200).send(recipients.length);

  recipients.forEach(async (recipient) => {
    await setCopiedField(recipient).catch((err) => {
      console.log(err);
      return res.status(502).end("Coud not send request for signing.");
    });
  });
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
});
