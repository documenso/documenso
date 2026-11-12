import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { prisma } from '@documenso/prisma';
import { seedTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('1234567890abcdef', 10);

const requestMetadata = {
  auth: null,
  requestMetadata: {},
  source: 'apiV2' as const,
};

test('[RECIPIENT][EMAIL_CASING]: document from template stores a mixed-case recipient email in lowercase', async () => {
  const { user, team } = await seedUser();

  const template = await seedTemplate({
    userId: user.id,
    teamId: team.id,
  });

  const mixedCaseEmail = `Signer.${nanoid()}@Test.Documenso.com`;

  const document = await createDocumentFromTemplate({
    id: {
      type: 'envelopeId',
      id: template.id,
    },
    userId: user.id,
    teamId: team.id,
    recipients: [
      {
        id: template.recipients[0].id,
        email: mixedCaseEmail,
        name: 'Signer',
      },
    ],
    requestMetadata,
  });

  const recipients = await prisma.recipient.findMany({
    where: {
      envelopeId: document.id,
    },
  });

  expect(recipients.map((recipient) => recipient.email)).toEqual([mixedCaseEmail.toLowerCase()]);
});
