import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, SigningStatus } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { getRecipientStepCards } from '../fixtures/envelope-editor';

/**
 * Signing is sequential, so a recipient who has already acted is at or before
 * the current step. Those steps hold persisted signing orders that the server
 * will not let us rewrite, so ordering is locked up to and including the last
 * of them. Later steps can only contain recipients who have not acted, so they
 * stay fully rearrangeable.
 */

test('[LOCKED_STEPS]: ordering is locked up to the signed step and free afterwards', async ({ page }) => {
  const { user, team } = await seedUser();
  const { user: signed } = await seedUser();
  const { user: signedPeer } = await seedUser();
  const { user: pendingB } = await seedUser();
  const { user: pendingC } = await seedUser();

  const { document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [signed, signedPeer, pendingB, pendingC],
    recipientsCreateOptions: [
      // Step 1 is a group, and one of its members has signed.
      { signingOrder: 1, signingStatus: SigningStatus.SIGNED },
      { signingOrder: 1, signingStatus: SigningStatus.NOT_SIGNED },
      { signingOrder: 2, signingStatus: SigningStatus.NOT_SIGNED },
      { signingOrder: 3, signingStatus: SigningStatus.NOT_SIGNED },
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

  await expect(getRecipientStepCards(page)).toHaveCount(3);

  const stepHandles = page.getByTestId('step-drag-handle');

  // Step 1 contains a signed recipient, so it is locked.
  await expect(stepHandles.nth(0)).toHaveClass(/pointer-events-none/);

  // Its ungroup control is unavailable too — splitting it would rewrite the
  // signed recipient's persisted order.
  await expect(page.getByTestId('ungroup-step-button')).toBeDisabled();

  // Steps after it hold only recipients who cannot have acted yet.
  await expect(stepHandles.nth(1)).not.toHaveClass(/pointer-events-none/);
  await expect(stepHandles.nth(2)).not.toHaveClass(/pointer-events-none/);

  // Nothing was rewritten by simply opening the editor.
  const recipients = await prisma.recipient.findMany({ where: { envelopeId: document.id } });

  expect(recipients.find((r) => r.email === signed.email)?.signingOrder).toBe(1);
  expect(recipients.find((r) => r.email === signedPeer.email)?.signingOrder).toBe(1);
  expect(recipients.find((r) => r.email === pendingB.email)?.signingOrder).toBe(2);
  expect(recipients.find((r) => r.email === pendingC.email)?.signingOrder).toBe(3);
});

/**
 * A signed recipient can sit out of sequence — a direct template signs at its
 * own template order, field insertion has no turn check, and a document can be
 * switched from parallel to sequential mid-flight. The rule is "up to and
 * including the last signed step" rather than "the signed prefix" precisely so
 * these stay safe: the earlier unsigned step is locked too.
 */
test('[LOCKED_STEPS]: a signed recipient mid-sequence locks the steps before it', async ({ page }) => {
  const { user, team } = await seedUser();
  const { user: firstPending } = await seedUser();
  const { user: signedSecond } = await seedUser();
  const { user: lastPending } = await seedUser();

  const { document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [firstPending, signedSecond, lastPending],
    recipientsCreateOptions: [
      { signingOrder: 1, signingStatus: SigningStatus.NOT_SIGNED },
      { signingOrder: 2, signingStatus: SigningStatus.SIGNED },
      { signingOrder: 3, signingStatus: SigningStatus.NOT_SIGNED },
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

  await expect(getRecipientStepCards(page)).toHaveCount(3);

  const stepHandles = page.getByTestId('step-drag-handle');

  // Step 1 has no signed recipient, but it sits before one — moving it would
  // reshuffle the signed recipient's position, so it is locked as well.
  await expect(stepHandles.nth(0)).toHaveClass(/pointer-events-none/);
  await expect(stepHandles.nth(1)).toHaveClass(/pointer-events-none/);

  // Only the step after the signed one remains movable.
  await expect(stepHandles.nth(2)).not.toHaveClass(/pointer-events-none/);
});

test('[LOCKED_STEPS]: every step stays draggable when nobody has signed', async ({ page }) => {
  const { user, team } = await seedUser();
  const { user: first } = await seedUser();
  const { user: second } = await seedUser();

  const { document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [first, second],
    recipientsCreateOptions: [
      { signingOrder: 1, signingStatus: SigningStatus.NOT_SIGNED },
      { signingOrder: 2, signingStatus: SigningStatus.NOT_SIGNED },
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

  await expect(getRecipientStepCards(page)).toHaveCount(2);

  const stepHandles = page.getByTestId('step-drag-handle');

  await expect(stepHandles.nth(0)).not.toHaveClass(/pointer-events-none/);
  await expect(stepHandles.nth(1)).not.toHaveClass(/pointer-events-none/);
});
