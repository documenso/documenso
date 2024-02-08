import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '..';
import { DocumentDataType } from '../client';

const examplePdf = fs
  .readFileSync(path.join(__dirname, '../../../assets/example.pdf'))
  .toString('base64');

type SeedTemplateOptions = {
  title?: string;
  userId: number;
  teamId?: number;
};

export const seedTemplate = async (options: SeedTemplateOptions) => {
  const { title = 'Untitled', userId, teamId } = options;

  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf,
      initialData: examplePdf,
    },
  });

  return await prisma.template.create({
    data: {
      title,
      templateDocumentDataId: documentData.id,
      userId: userId,
      teamId,
    },
  });
};
