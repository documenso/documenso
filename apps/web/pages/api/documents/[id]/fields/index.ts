import { NextApiRequest, NextApiResponse } from "next";
import { getDocument } from "@documenso/lib/query";
import { defaultHandler, defaultResponder, getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { FieldType, Document as PrismaDocument } from "@prisma/client";

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getUserFromToken(req, res);
  const { id: documentId } = req.query;
  const body: {
    id: number;
    type: FieldType;
    page: number;
    position: { x: number; y: number };
  } = req.body;

  if (!user) return;

  if (!documentId) {
    res.status(400).send("Missing parameter documentId.");
    return;
  }

  // todo entity ownerships checks

  const fields = await prisma.field.findMany({
    where: { documentId: +documentId },
    include: { Recipient: true },
  });

  return res.status(200).end(JSON.stringify(fields));
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { token: recipientToken } = req.query;
  let user = null;
  if (!recipientToken) user = await getUserFromToken(req, res);
  if (!user && !recipientToken) return res.status(401).end();
  const body: {
    id: number;
    type: FieldType;
    page: number;
    positionX: number;
    positionY: number;
    Recipient: { id: number };
    customText: string;
  } = req.body;

  const { id: documentId } = req.query;
  if (!documentId) {
    return res.status(400).send("Missing parameter documentId.");
  }

  if (recipientToken) {
    const recipient = await prisma.recipient.findFirst({
      where: { token: recipientToken?.toString() },
    });

    if (!recipient || recipient?.documentId !== +documentId)
      return res.status(401).send("Recipient does not have access to this document.");
  }

  if (user) {
    const document: PrismaDocument = await getDocument(+documentId, req, res);
    // todo entity ownerships checks
    if (document.userId !== user.id) {
      return res.status(401).send("User does not have access to this document.");
    }
  }

  const field = await prisma.field.upsert({
    where: {
      id: +body.id,
    },
    update: {
      positionX: +body.positionX,
      positionY: +body.positionY,
      customText: body.customText,
    },
    create: {
      documentId: +documentId,
      type: body.type,
      page: +body.page,
      inserted: false,
      positionX: +body.positionX,
      positionY: +body.positionY,
      customText: body.customText,
      recipientId: body.Recipient.id,
    },
    include: {
      Recipient: true,
    },
  });

  return res.status(201).end(JSON.stringify(field));
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
