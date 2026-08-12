import { nanoid } from 'nanoid';

import { prisma } from '..';
import { DocumentStatus } from '../client';
import { seedBlankDocument } from './documents';
import { seedUser } from './users';

const MEDIUM_ACCOUNT_EMAIL = 'medium-account@documenso.com';
const DOCUMENT_COUNT = 1000;

const STATUSES = [DocumentStatus.DRAFT, DocumentStatus.PENDING, DocumentStatus.COMPLETED];

export const seedDatabase = async () => {
  const existingUser = await prisma.user.findFirst({
    where: {
      email: MEDIUM_ACCOUNT_EMAIL,
    },
  });

  if (existingUser) {
    return;
  }

  console.log(`[SEEDING]: Creating medium account with ${DOCUMENT_COUNT} documents...`);

  const { user, team } = await seedUser({
    name: 'Medium Account',
    email: MEDIUM_ACCOUNT_EMAIL,
  });

  const recipientEmails = Array.from({ length: 20 }, (_, i) => `recipient-${i}@test.documenso.com`);

  for (let i = 0; i < DOCUMENT_COUNT; i++) {
    const status = STATUSES[i % STATUSES.length];

    const document = await seedBlankDocument(user, team.id, {
      key: `medium-${i}`,
      createDocumentOptions: {
        title: `[MEDIUM] Document ${i} - ${status}`,
        status,
      },
    });

    // Add 1-3 recipients per document.
    const recipientCount = (i % 3) + 1;

    for (let r = 0; r < recipientCount; r++) {
      await prisma.recipient.create({
        data: {
          email: recipientEmails[(i + r) % recipientEmails.length],
          name: `Recipient ${r}`,
          token: nanoid(),
          envelopeId: document.id,
        },
      });
    }

    // Also create some documents where the medium user is a recipient (not owner).
    // Every 5th document, create an extra doc owned by a "ghost" sender with medium user as recipient.
    if (i % 5 === 0) {
      await prisma.recipient.create({
        data: {
          email: MEDIUM_ACCOUNT_EMAIL,
          name: 'Medium Account',
          token: nanoid(),
          envelopeId: document.id,
        },
      });
    }

    if (i % 100 === 0) {
      console.log(`[SEEDING]: Created ${i}/${DOCUMENT_COUNT} documents...`);
    }
  }

  console.log(`[SEEDING]: Medium account seeded with ${DOCUMENT_COUNT} documents.`);
};
