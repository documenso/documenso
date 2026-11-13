import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, SendStatus, SigningStatus } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import {
  clickAddSignerButton,
  getRecipientEmailInputs,
  getRecipientStepCards,
  setRecipientEmail,
} from '../fixtures/envelope-editor';

/**
 * Numbers sort ahead of unordered rows, so numbering anything behind a signed
 * unordered recipient would move it in front of them.
 */

test('[LEGACY_UNORDERED_TAIL]: additions queue behind a locked unordered recipient', async ({ page }) => {
  const { user, team } = await seedUser();
  const { user: alice } = await seedUser();
  const { user: bob } = await seedUser();

  const { document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [alice, bob],
    recipientsCreateOptions: [
      { signingOrder: null, signingStatus: SigningStatus.SIGNED, sendStatus: SendStatus.SENT },
      { signingOrder: null, signingStatus: SigningStatus.NOT_SIGNED, sendStatus: SendStatus.NOT_SENT },
    ],
    fields: [],
    updateDocumentOptions: {
      internalVersion: 2,
      documentMeta: {
        upsert: {
          create: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
          update: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
        },
      },
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit?step=uploadAndRecipients`,
  });

  await expect(getRecipientEmailInputs(page)).toHaveCount(2);
  await expect(getRecipientStepCards(page)).toHaveCount(2);

  await expect(getRecipientEmailInputs(page).nth(0)).toHaveValue(alice.email);
  await expect(getRecipientEmailInputs(page).nth(1)).toHaveValue(bob.email);

  await clickAddSignerButton(page);
  await setRecipientEmail(page, 2, 'carol@example.com');

  await expect
    .poll(async () => {
      const recipients = await prisma.recipient.findMany({ where: { envelopeId: document.id } });

      return recipients.find((recipient) => recipient.email === 'carol@example.com')?.id ?? null;
    })
    .not.toBeNull();

  const recipients = await prisma.recipient.findMany({
    where: { envelopeId: document.id },
    orderBy: { id: 'asc' },
  });

  expect(recipients.map((recipient) => [recipient.email, recipient.signingOrder])).toEqual([
    [alice.email, null],
    [bob.email, null],
    ['carol@example.com', null],
  ]);

  await expect(getRecipientStepCards(page)).toHaveCount(3);
  await expect(getRecipientEmailInputs(page).nth(2)).toHaveValue('carol@example.com');
});
