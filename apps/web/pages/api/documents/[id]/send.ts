import { NextApiRequest, NextApiResponse } from "next";
import { sendSigningRequest } from "@documenso/lib/mail";
import { getDocument } from "@documenso/lib/query";
import { defaultHandler, defaultResponder, getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { Document as PrismaDocument, SendStatus } from "@prisma/client";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await getUserFromToken(req, res);
    const { id: documentId } = req.query;
    const { resendTo: resendTo = [] } = req.body;

    if (!user) {
      return res.status(401).send("Unauthorized");
    }

    if (!documentId) {
      return res.status(400).send("Missing parameter documentId.");
    }

    const document: PrismaDocument = await getDocument(+documentId, req, res);

    if (!document) {
      res.status(404).end(`No document with id ${documentId} found.`);
    }

    let recipientCondition: any = {
      documentId: +documentId,
      sendStatus: SendStatus.NOT_SENT,
    };

    if (resendTo.length) {
      recipientCondition = {
        documentId: +documentId,
        id: { in: resendTo },
      };
    }

    const recipients = await prisma.recipient.findMany({
      where: {
        ...recipientCondition,
      },
    });

    if (!recipients.length) {
      return res.status(200).send(recipients.length);
    }

    let sentRequests = 0;

    await Promise.all(
      recipients.map(async (recipient) => {
        await sendSigningRequest(recipient, document, user);

        sentRequests++;
      })
    );

    if (sentRequests === recipients.length) {
      return res.status(200).send(recipients.length);
    }

    return res.status(502).end("Coud not send request for signing.");
  } catch (err) {
    return res.status(502).end("Coud not send request for signing.");
  }
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
