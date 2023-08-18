import { NextApiRequest, NextApiResponse } from 'next';

import formidable from 'formidable';
import { type File } from 'formidable';
import { readFileSync } from 'fs';

import { getServerSession } from '@documenso/lib/next-auth/get-server-session';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

import {
  TCreateDocumentRequestSchema,
  TCreateDocumentResponseSchema,
} from '~/api/document/create/types';

export const config = {
  api: {
    bodyParser: false,
  },
};

export type TFormidableCreateDocumentRequestSchema = {
  file: File;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TCreateDocumentResponseSchema>,
) {
  const user = await getServerSession({ req, res });

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
    });
  }

  try {
    const form = formidable();

    const { file } = await new Promise<TFormidableCreateDocumentRequestSchema>(
      (resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) {
            reject(err);
          }

          // We had intended to do this with Zod but we can only validate it
          // as a persistent file which does not include the properties that we
          // need.
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
          resolve({ ...fields, ...files } as any);
        });
      },
    );

    const fileBuffer = readFileSync(file.filepath);

    const document = await prisma.document.create({
      data: {
        title: file.originalFilename ?? file.newFilename,
        status: DocumentStatus.DRAFT,
        userId: user.id,
        document: fileBuffer.toString('base64'),
        created: new Date(),
      },
    });

    return res.status(200).json({
      id: document.id,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}

/**
 * This is a hack to ensure that the types are correct.
 */
type FormidableSatisfiesCreateDocument =
  keyof TCreateDocumentRequestSchema extends keyof TFormidableCreateDocumentRequestSchema
    ? true
    : never;

true satisfies FormidableSatisfiesCreateDocument;
