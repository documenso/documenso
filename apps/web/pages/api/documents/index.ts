import { defaultHandler, defaultResponder } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { NextApiRequest, NextApiResponse } from "next";
import { getUserFromToken } from "@documenso/lib/server";
import formidable, { Files } from "formidable";
import { getToken } from "next-auth/jwt";

export const config = {
  api: {
    bodyParser: false,
  },
};

// POST /documents
async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const form = formidable();

  const user = await getUserFromToken(req, res);
  if (!user) return;
  form.parse(req, async (err, fields, files) => {
    if (err) throw err;

    let uploadedDocument: any = files["document"];
    const path = uploadedDocument[0].filepath;
    const fs = require("fs");
    const buffer = fs.readFileSync(path);
    const documentAsBase64EncodedString = buffer.toString("base64");
    await prisma
      .$transaction([
        prisma.document.create({
          data: {
            userId: user?.id,
            document: documentAsBase64EncodedString,
          },
        }),
      ])
      .then((document) => {
        return res.status(201).send(document[0].id);
      })
      .catch((err) => {
        throw err;
      });
  });
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  let user = await getUserFromToken(req, res);
  if (!user) return;

  return res
    .status(200)
    .json(await prisma.document.findMany({ where: { userId: user?.id } }));
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
