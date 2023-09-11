'use server';

import { nanoid } from 'nanoid';

import { prisma } from '@documenso/prisma';
import { DocumentContent } from '@documenso/prisma/client';

type CreateTemplateInput = {
  name: string;
  description: string;
  document: DocumentContent;
  userId: number;
};

export const createTemplate = async ({
  name,
  description,
  document,
  userId,
}: CreateTemplateInput) => {
  const createTemplateDocument = await prisma.documentContent.create({
    data: {
      content: document.content,
      name: document.name,
    },
  });

  const createdTemplate = await prisma.template.create({
    data: {
      name,
      slug: nanoid(10),
      description,
      ownerId: userId,
      documentId: createTemplateDocument.id,
    },
  });
  return createdTemplate;
};
