import { NextApiRequest, NextApiResponse } from "next";
import { getDocumentsForUserFromToken } from "@documenso/lib/query";
import { defaultHandler, defaultResponder } from "@documenso/lib/server";
import { getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import formidable from "formidable";
import { isSubscribedServer } from "@documenso/lib/stripe";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const form = formidable();

  const user = await getUserFromToken(req, res);
  if (!user) {
    return res.status(401).end();
  };

  const isSubscribed = await isSubscribedServer(req);

  if (!isSubscribed) {
    throw new Error("User is not subscribed.");
  }


  form.parse(req, async (err, fields, files) => {
    if (err) throw err;

    const uploadedDocument: any = files["document"];
    const title = uploadedDocument[0].originalFilename;
    const path = uploadedDocument[0].filepath;
    const fs = require("fs");
    const buffer = fs.readFileSync(path);
    const documentAsBase64EncodedString = buffer.toString("base64");
    await prisma
      .$transaction([
        prisma.document.create({
          data: {
            title: title,
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
  const user = await getUserFromToken(req, res);
  if (!user) return;

  const documents = await getDocumentsForUserFromToken({ req: req, res: res });

  return res.status(200).json(documents);
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
