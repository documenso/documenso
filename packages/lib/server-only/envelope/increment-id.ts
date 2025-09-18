import { prisma } from '@documenso/prisma';

import { mapDocumentIdToSecondaryId, mapTemplateIdToSecondaryId } from '../../utils/envelope';

export const incrementDocumentId = async () => {
  const documentIdCounter = await prisma.counter.update({
    where: {
      id: 'document',
    },
    data: {
      value: {
        increment: 1,
      },
    },
  });

  return {
    documentId: documentIdCounter.value,
    formattedDocumentId: mapDocumentIdToSecondaryId(documentIdCounter.value),
  };
};

export const incrementTemplateId = async () => {
  const templateIdCounter = await prisma.counter.update({
    where: {
      id: 'template',
    },
    data: {
      value: {
        increment: 1,
      },
    },
  });

  return {
    templateId: templateIdCounter.value,
    formattedTemplateId: mapTemplateIdToSecondaryId(templateIdCounter.value),
  };
};
