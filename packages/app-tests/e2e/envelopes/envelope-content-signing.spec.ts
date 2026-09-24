import {
  EnvelopeContentShapeType,
  EnvelopeContentType,
  ZEnvelopeContentMetaSchema,
} from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedCompletedDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';
import { getContentGroupsForPage, getPageCanvas } from '../fixtures/contents';

/**
 * Seed a text content and a rectangle onto the first page of an envelope.
 */
const seedStaticContents = async (envelopeId: string, envelopeItemId: string) => {
  await prisma.envelopeContent.createMany({
    data: [
      {
        id: generateDatabaseId('envelope_content'),
        envelopeId,
        envelopeItemId,
        contentMeta: ZEnvelopeContentMetaSchema.parse({
          type: EnvelopeContentType.TEXT,
          page: 1,
          rotation: 0,
          zIndex: 0,
          positionX: 10,
          positionY: 10,
          width: 40,
          height: 6,
          text: 'Signing content',
        }),
      },
      {
        id: generateDatabaseId('envelope_content'),
        envelopeId,
        envelopeItemId,
        contentMeta: ZEnvelopeContentMetaSchema.parse({
          type: EnvelopeContentType.SHAPE,
          shape: EnvelopeContentShapeType.RECTANGLE,
          page: 1,
          rotation: 0,
          zIndex: 0,
          positionX: 10,
          positionY: 20,
          width: 40,
          height: 10,
          strokeWidth: 2,
          strokeColor: '#d00000',
          strokeStyle: 'solid',
        }),
      },
    ],
  });
};

test('contents are not rendered again on a completed document', async ({ page }) => {
  const { user, team } = await seedUser();

  const document = await seedCompletedDocument(user, team.id, [user], { internalVersion: 2 });

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { envelopeItems: true },
  });

  // Contents on a completed envelope are already imprinted onto its PDF.
  await seedStaticContents(envelope.id, envelope.envelopeItems[0].id);

  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/documents/${document.id}` });

  await expect(getPageCanvas(page)).toBeVisible();

  expect(await getContentGroupsForPage(page)).toHaveLength(0);
});
