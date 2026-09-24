import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, SigningStatus } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { getRecipientEmailInputs, getRecipientStepCards, setRecipientName } from '../fixtures/envelope-editor';

/**
 * A recipient with no persisted signing order means "last" everywhere on the
 * server (queries sort NULLS LAST, and `effectiveSigningOrder` maps null to the end).
 * The editor must not invent an order from array position: the guess can land
 * on a real order — which now means "same signing step" — or move the
 * recipient ahead of one that was meant to sign first.
 */

const seedMixedOrderEnvelope = async (options: { firstOrder: number }) => {
  const { user, team } = await seedUser();
  const { user: ordered } = await seedUser();
  const { user: unordered } = await seedUser();

  const { document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [ordered, unordered],
    recipientsCreateOptions: [
      { signingOrder: options.firstOrder, signingStatus: SigningStatus.NOT_SIGNED },
      // Created second, so it takes the higher id — this is the position the
      // editor used to turn into `index + 1`.
      { signingOrder: null, signingStatus: SigningStatus.NOT_SIGNED },
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

  return { user, team, document, orderedEmail: ordered.email, unorderedEmail: unordered.email };
};

test('[NULL_ORDER_HYDRATION]: a null-order recipient does not join an existing step', async ({ page }) => {
  // The unordered recipient sits at index 1, so `index + 1` would collide with
  // the persisted order 2 and render the two as one group.
  const { user, team, document, orderedEmail, unorderedEmail } = await seedMixedOrderEnvelope({ firstOrder: 2 });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit?step=uploadAndRecipients`,
  });

  await expect(getRecipientEmailInputs(page)).toHaveCount(2);

  // Two independent steps, not a single group.
  await expect(getRecipientStepCards(page)).toHaveCount(2);
  await expect(page.getByText('2 recipients · any order')).not.toBeVisible();

  // Persisted orders must stay distinct once the editor saves.
  await setRecipientName(page, 1, 'Renamed Unordered');

  await expect
    .poll(async () => {
      const recipients = await prisma.recipient.findMany({ where: { envelopeId: document.id } });

      return recipients.find((recipient) => recipient.email === unorderedEmail)?.name;
    })
    .toBe('Renamed Unordered');

  const recipients = await prisma.recipient.findMany({ where: { envelopeId: document.id } });

  const orderedRecipient = recipients.find((recipient) => recipient.email === orderedEmail);
  const unorderedRecipient = recipients.find((recipient) => recipient.email === unorderedEmail);

  expect(orderedRecipient?.signingOrder).not.toBe(unorderedRecipient?.signingOrder);
});

test('[NULL_ORDER_HYDRATION]: a null-order recipient stays last', async ({ page }) => {
  // Persisted order 3 with the unordered recipient at index 1: `index + 1`
  // would give it 2 and move it ahead of the recipient meant to sign first.
  const { user, team, document, orderedEmail, unorderedEmail } = await seedMixedOrderEnvelope({ firstOrder: 3 });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit?step=uploadAndRecipients`,
  });

  await expect(getRecipientEmailInputs(page)).toHaveCount(2);

  // The ordered recipient must still be shown first.
  await expect(getRecipientEmailInputs(page).nth(0)).toHaveValue(orderedEmail);
  await expect(getRecipientEmailInputs(page).nth(1)).toHaveValue(unorderedEmail);
});
