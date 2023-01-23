import {
  defaultHandler,
  defaultResponder,
  getUserFromToken,
} from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { NextApiRequest, NextApiResponse } from "next";
import { useRouter } from "next/router";
import fs from "fs";
import { buffer } from "stream/consumers";
import { Document as PrismaDocument } from "@prisma/client";

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = getUserFromToken(req, res);
  const { id: documentId } = req.query;

  if (!user) return;

  if (!documentId) {
    res.status(400).send("Missing parameter documentId.");
    return;
  }

  const document: PrismaDocument = await prisma.document.findFirstOrThrow({
    where: {
      id: +documentId,
    },
  });

  if (!document)
    res.status(404).end(`No document with id ${documentId} found.`);

  console.log("document: " + document?.document);
  const buffer: Buffer = Buffer.from(document.document.toString(), "base64");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=dummy.pdf");
  res.setHeader("Content-Length", buffer.length);

  res.status(200).send(buffer);
  return;
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
});
