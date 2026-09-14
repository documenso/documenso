import type { Prisma } from '@prisma/client';

import { generateDatabaseId } from '../../universal/id';
import { buildDataContentCloneInput } from '../data-content/clone-data-content';

type CopyEnvelopeContentsOptions = {
  tx: Prisma.TransactionClient;

  /**
   * The envelope to copy the contents from.
   */
  fromEnvelopeId: string;

  /**
   * The envelope to copy the contents to.
   */
  toEnvelopeId: string;

  /**
   * Maps the source envelope item IDs to the destination envelope item IDs.
   *
   * Contents whose envelope item is not mapped are skipped, e.g. when an
   * envelope item was not copied.
   */
  envelopeItemIdMap: Record<string, string>;
};

/**
 * Copy the contents of one envelope onto another, e.g. when creating a
 * document from a template or duplicating an envelope.
 */
export const copyEnvelopeContents = async ({
  tx,
  fromEnvelopeId,
  toEnvelopeId,
  envelopeItemIdMap,
}: CopyEnvelopeContentsOptions) => {
  const contents = await tx.envelopeContent.findMany({
    where: {
      envelopeId: fromEnvelopeId,
    },
    include: {
      dataContent: true,
    },
  });

  const copies = contents.flatMap((content) => {
    const envelopeItemId = envelopeItemIdMap[content.envelopeItemId];

    if (!envelopeItemId) {
      return [];
    }

    // Each content owns its data content, so the data is cloned rather than
    // shared with the source envelope.
    const dataContent = content.dataContent ? buildDataContentCloneInput(content.dataContent) : null;

    return [
      {
        dataContent,
        content: {
          id: generateDatabaseId('envelope_content'),
          envelopeId: toEnvelopeId,
          envelopeItemId,
          metadata: content.metadata,
          dataContentId: dataContent?.id ?? null,
          zIndex: content.zIndex,
        },
      },
    ];
  });

  if (copies.length === 0) {
    return;
  }

  const dataContentsToCreate = copies.flatMap((copy) => (copy.dataContent ? [copy.dataContent] : []));

  if (dataContentsToCreate.length > 0) {
    await tx.dataContent.createMany({
      data: dataContentsToCreate,
    });
  }

  await tx.envelopeContent.createMany({
    data: copies.map((copy) => copy.content),
  });
};
