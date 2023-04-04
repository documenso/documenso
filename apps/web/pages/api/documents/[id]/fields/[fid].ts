import { NextApiRequest, NextApiResponse } from "next";
import { getDocument } from "@documenso/lib/query";
import { defaultHandler, defaultResponder, getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { FieldType, Document as PrismaDocument } from "@prisma/client";
import short from "short-uuid";

async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getUserFromToken(req, res);
  const { fid: fieldId } = req.query;
  const body: {
    id: number;
    type: FieldType;
    page: number;
    position: { x: number; y: number };
  } = req.body;

  if (!user) return;

  if (!fieldId) {
    res.status(400).send("Missing parameter fieldId.");
    return;
  }

  await prisma.field.delete({ where: { id: +fieldId } });

  return res.status(200).end();
}

export default defaultHandler({
  DELETE: Promise.resolve({ default: defaultResponder(deleteHandler) }),
});
