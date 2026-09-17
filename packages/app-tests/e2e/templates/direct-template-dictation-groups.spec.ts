import { createDocumentFromDirectTemplate } from '@documenso/lib/server-only/template/create-document-from-direct-template';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';
import { seedDirectTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentSigningOrder, FieldType, RecipientRole } from '@prisma/client';

/**
 * "Dictate next signer" lets the signer choose who acts in the NEXT step. With
 * signing groups the direct recipient can share a step with someone else, and
 * because the direct recipient is created as SIGNED before the pending query
 * runs, that same-step peer would otherwise look like the "next" recipient.
 *
 * The UI never offers dictation in that case, so this exercises the server
 * directly — the only way the gap is reachable.
 */

const requestMetadata: ApiRequestMetadata = {
  requestMetadata: {},
  source: 'app',
  auth: null,
};

const PEER_EMAIL = 'peer@documenso.com';
const PEER_NAME = 'Peer Signer';
const LATER_EMAIL = 'later@documenso.com';
const LATER_NAME = 'Later Signer';

const DICTATED = { email: 'dictated@documenso.com', name: 'Dictated Signer' };

/**
 * Seeds a direct template whose direct recipient sits at `directSigningOrder`,
 * plus a peer at `peerSigningOrder` and a signer in a strictly later step.
 */
const seedDirectTemplateWithPeer = async (options: { peerSigningOrder: number }) => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    title: '[TEST] Direct template dictation',
    userId: user.id,
    teamId: team.id,
  });

  await prisma.documentMeta.update({
    where: { id: template.documentMetaId },
    data: {
      signingOrder: DocumentSigningOrder.SEQUENTIAL,
      allowDictateNextSigner: true,
    },
  });

  const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
    where: { envelopeId: template.id },
  });

  // Every SIGNER needs a signature field or the direct-template flow rejects
  // the template before it reaches the dictation logic.
  const createSigner = async (email: string, name: string, signingOrder: number) => {
    const recipient = await prisma.recipient.create({
      data: {
        envelopeId: template.id,
        email,
        name,
        token: Math.random().toString().slice(2, 12),
        role: RecipientRole.SIGNER,
        signingOrder,
      },
    });

    await prisma.field.create({
      data: {
        envelopeId: template.id,
        envelopeItemId: envelopeItem.id,
        recipientId: recipient.id,
        type: FieldType.SIGNATURE,
        page: 1,
        positionX: 5,
        positionY: 20 + signingOrder * 5,
        width: 20,
        height: 5,
        customText: '',
        inserted: false,
      },
    });

    return recipient;
  };

  const peer = await createSigner(PEER_EMAIL, PEER_NAME, options.peerSigningOrder);
  const later = await createSigner(LATER_EMAIL, LATER_NAME, 2);

  const directRecipient = template.recipients.find((recipient) => recipient.signingOrder === 1);
  const directSignatureField = template.fields.find((field) => field.type === FieldType.SIGNATURE);

  if (!directRecipient || !directSignatureField) {
    throw new Error('Seeded direct template is missing its recipient or signature field');
  }

  // Read updatedAt last: the writes above bump it, and the flow rejects a stale value.
  const refreshed = await prisma.envelope.findFirstOrThrow({ where: { id: template.id } });

  return {
    directLinkToken: template.directLink?.token ?? '',
    directSignatureFieldId: directSignatureField.id,
    templateUpdatedAt: refreshed.updatedAt,
    peer,
    later,
  };
};

const signDirectTemplate = async (seeded: Awaited<ReturnType<typeof seedDirectTemplateWithPeer>>) =>
  await createDocumentFromDirectTemplate({
    directRecipientName: 'Direct Signer',
    directRecipientEmail: 'direct-signer@documenso.com',
    directTemplateToken: seeded.directLinkToken,
    templateUpdatedAt: seeded.templateUpdatedAt,
    signedFieldValues: [
      {
        token: seeded.directLinkToken,
        fieldId: seeded.directSignatureFieldId,
        value: 'Direct Signer',
        isBase64: false,
      },
    ],
    nextSigner: DICTATED,
    requestMetadata,
  });

test('[DIRECT_TEMPLATE_DICTATION]: does not dictate a recipient sharing the direct recipient step', async () => {
  const seeded = await seedDirectTemplateWithPeer({ peerSigningOrder: 1 });

  const { envelopeId } = await signDirectTemplate(seeded);

  const recipients = await prisma.recipient.findMany({ where: { envelopeId } });

  const peer = recipients.find((recipient) => recipient.email === PEER_EMAIL);
  const dictated = recipients.find((recipient) => recipient.email === DICTATED.email);

  // The same-step peer must be untouched...
  expect(peer).toBeDefined();
  expect(peer?.name).toBe(PEER_NAME);
  expect(peer?.signingOrder).toBe(1);

  // ...and nobody at all should have been renamed, since the next step is not reachable yet.
  expect(dictated).toBeUndefined();
});

test('[DIRECT_TEMPLATE_DICTATION]: still dictates the next step when the direct recipient is alone', async () => {
  const seeded = await seedDirectTemplateWithPeer({ peerSigningOrder: 3 });

  const { envelopeId } = await signDirectTemplate(seeded);

  const recipients = await prisma.recipient.findMany({ where: { envelopeId } });

  // The order-2 signer is the sole member of the next step, so dictation applies.
  const dictated = recipients.find((recipient) => recipient.email === DICTATED.email);

  expect(dictated).toBeDefined();
  expect(dictated?.name).toBe(DICTATED.name);
  expect(dictated?.signingOrder).toBe(2);

  // The untouched recipients keep their seeded identities.
  expect(recipients.some((recipient) => recipient.email === LATER_EMAIL)).toBe(false);
  expect(recipients.some((recipient) => recipient.email === PEER_EMAIL)).toBe(true);
});
