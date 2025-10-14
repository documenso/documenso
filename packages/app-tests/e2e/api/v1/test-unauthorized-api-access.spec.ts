import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import {
  mapSecondaryIdToDocumentId,
  mapSecondaryIdToTemplateId,
} from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { DocumentDataType, FieldType } from '@documenso/prisma/client';
import {
  seedBlankDocument,
  seedCompletedDocument,
  seedDraftDocument,
  seedPendingDocumentWithFullFields,
} from '@documenso/prisma/seed/documents';
import { seedBlankTemplate, seedTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

test.describe('Document Access API V1', () => {
  test.describe('Document GET endpoint', () => {
    test('should block unauthorized access to documents not owned by the user', async ({
      request,
    }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const documentA = await seedBlankDocument(userA, teamA.id);

      // User B cannot access User A's document
      const resB = await request.get(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
        },
      );

      expect(resB.ok()).toBeFalsy();
      expect(resB.status()).toBe(404);
    });

    test('should allow authorized access to documents owned by the user', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const documentA = await seedBlankDocument(userA, teamA.id);

      // User A can access their own document
      const resA = await request.get(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
        },
      );

      expect(resA.ok()).toBeTruthy();
      expect(resA.status()).toBe(200);
    });
  });

  test.describe('Document download endpoint', () => {
    test('should block unauthorized access to document download endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const documentA = await seedCompletedDocument(userA, teamA.id, ['test@example.com'], {
        createDocumentOptions: { title: 'Document 1 - Completed' },
      });

      const resB = await request.get(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/download`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
        },
      );

      const res = await resB.json();

      expect(resB.ok()).toBeFalsy();
      expect(resB.status()).toBe(404);
    });

    test('should allow authorized access to document download endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const documentA = await seedCompletedDocument(userA, teamA.id, ['test@example.com'], {
        createDocumentOptions: { title: 'Document 1 - Completed' },
      });

      await prisma.documentData.update({
        where: {
          id: documentA.envelopeItems[0].documentDataId,
        },
        data: {
          type: DocumentDataType.S3_PATH,
        },
      });

      const resA = await request.get(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/download`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
        },
      );

      const res = await resA.json();

      if (res.message === 'Document downloads are only available when S3 storage is configured.') {
        expect(resA.ok()).toBeFalsy();
        expect(resA.status()).toBe(500);
      } else {
        expect(resA.ok()).toBeTruthy();
        expect(resA.status()).toBe(200);
      }
    });
  });

  test.describe('Document delete endpoint', () => {
    test('should block unauthorized access to document delete endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const documentA = await seedBlankDocument(userA, teamA.id);

      const resB = await request.delete(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
        },
      );

      expect(resB.ok()).toBeFalsy();
      expect(resB.status()).toBe(404);
    });

    test('should allow authorized access to document delete endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const documentA = await seedBlankDocument(userA, teamA.id);

      const resA = await request.delete(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
        },
      );

      expect(resA.ok()).toBeTruthy();
      expect(resA.status()).toBe(200);
    });
  });

  test.describe('Document send endpoint', () => {
    test('should block unauthorized access to document send endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const { document: documentA } = await seedPendingDocumentWithFullFields({
        owner: userA,
        recipients: ['test@example.com'],
        teamId: teamA.id,
      });

      const resB = await request.post(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/send`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {},
        },
      );

      expect(resB.ok()).toBeFalsy();
      expect(resB.status()).toBe(500);
    });

    test('should allow authorized access to document send endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const { document: documentA } = await seedPendingDocumentWithFullFields({
        owner: userA,
        recipients: ['test@example.com'],
        teamId: teamA.id,
      });

      const resA = await request.post(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/send`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {},
        },
      );

      expect(resA.ok()).toBeTruthy();
      expect(resA.status()).toBe(200);
    });
  });

  test.describe('Document resend endpoint', () => {
    test('should block unauthorized access to document resend endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const { user: recipientUser } = await seedUser();

      const { document: documentA, recipients } = await seedPendingDocumentWithFullFields({
        owner: userA,
        recipients: [recipientUser.email],
        teamId: teamA.id,
      });

      const resB = await request.post(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/resend`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            recipients: [recipients[0].id],
          },
        },
      );

      expect(resB.ok()).toBeFalsy();
      expect(resB.status()).toBe(500);
    });

    test('should allow authorized access to document resend endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const { user: recipientUser } = await seedUser();

      const { document: documentA, recipients } = await seedPendingDocumentWithFullFields({
        owner: userA,
        recipients: [recipientUser.email],
        teamId: teamA.id,
      });

      const resA = await request.post(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/resend`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            recipients: [recipients[0].id],
          },
        },
      );

      expect(resA.ok()).toBeTruthy();
      expect(resA.status()).toBe(200);
    });
  });

  test.describe('Document recipients POST endpoint', () => {
    test('should block unauthorized access to document recipients endpoint', async ({
      request,
    }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const documentA = await seedBlankDocument(userA, teamA.id);

      const resB = await request.post(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/recipients`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: { name: 'Test', email: 'test@example.com' },
        },
      );

      expect(resB.ok()).toBeFalsy();
      expect(resB.status()).toBe(401);
    });

    test('should allow authorized access to document recipients endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const documentA = await seedBlankDocument(userA, teamA.id);

      const resA = await request.post(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/recipients`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: { name: 'Test', email: 'test@example.com' },
        },
      );

      expect(resA.ok()).toBeTruthy();
      expect(resA.status()).toBe(200);
    });
  });

  test.describe('Document recipients PATCH endpoint', () => {
    test('should block unauthorized access to PATCH on recipients endpoint', async ({
      request,
    }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const { user: userRecipient } = await seedUser();

      const documentA = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: documentA.id,
          email: userRecipient.email,
        },
      });

      const patchRes = await request.patch(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/recipients/${recipient!.id}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            name: 'New Name',
            email: 'new@example.com',
            role: 'SIGNER',
            signingOrder: null,
            authOptions: {
              accessAuth: [],
              actionAuth: [],
            },
          },
        },
      );

      expect(patchRes.ok()).toBeFalsy();
      expect(patchRes.status()).toBe(401);
    });

    test('should allow authorized access to PATCH on recipients endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const { user: userRecipient } = await seedUser();

      const documentA = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: documentA.id,
          email: userRecipient.email,
        },
      });

      const patchRes = await request.patch(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/recipients/${recipient!.id}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            name: 'New Name',
            email: 'new@example.com',
            role: 'SIGNER',
            signingOrder: null,
            authOptions: {
              accessAuth: [],
              actionAuth: [],
            },
          },
        },
      );

      expect(patchRes.ok()).toBeTruthy();
      expect(patchRes.status()).toBe(200);
    });
  });

  test.describe('Document recipients DELETE endpoint', () => {
    test('should block unauthorized access to DELETE on recipients endpoint', async ({
      request,
    }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const { user: userRecipient } = await seedUser();

      const documentA = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: documentA.id,
          email: userRecipient.email,
        },
      });

      const deleteRes = await request.delete(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/recipients/${recipient!.id}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {},
        },
      );

      expect(deleteRes.ok()).toBeFalsy();
      expect(deleteRes.status()).toBe(401);
    });

    test('should allow authorized access to DELETE on recipients endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const { user: userRecipient } = await seedUser();

      const documentA = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: documentA.id,
          email: userRecipient.email,
        },
      });

      const deleteRes = await request.delete(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/recipients/${recipient!.id}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {},
        },
      );

      expect(deleteRes.ok()).toBeTruthy();
      expect(deleteRes.status()).toBe(200);
    });
  });

  test.describe('Document fields POST endpoint', () => {
    test('should block unauthorized access to document fields endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const { user: recipientUser } = await seedUser();

      const documentA = await seedDraftDocument(userA, teamA.id, [recipientUser.email]);

      const documentRecipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: documentA.id,
          email: recipientUser.email,
        },
      });

      const resB = await request.post(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/fields`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            recipientId: documentRecipient!.id,
            type: 'SIGNATURE',
            pageNumber: 1,
            pageX: 1,
            pageY: 1,
            pageWidth: 1,
            pageHeight: 1,
          },
        },
      );

      expect(resB.ok()).toBeFalsy();
      expect(resB.status()).toBe(404);
    });

    test('should allow authorized access to document fields endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const { user: recipientUser } = await seedUser();

      const documentA = await seedDraftDocument(userA, teamA.id, [recipientUser.email]);

      const documentRecipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: documentA.id,
          email: recipientUser.email,
        },
      });

      const resA = await request.post(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/fields`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            recipientId: documentRecipient!.id,
            type: 'SIGNATURE',
            pageNumber: 1,
            pageX: 1,
            pageY: 1,
            pageWidth: 1,
            pageHeight: 1,
          },
        },
      );

      expect(resA.ok()).toBeTruthy();
      expect(resA.status()).toBe(200);
    });
  });

  test.describe('Template GET endpoint', () => {
    test('should block unauthorized access to template get endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const templateA = await seedBlankTemplate(userA, teamA.id);

      const resB = await request.get(
        `${WEBAPP_BASE_URL}/api/v1/templates/${mapSecondaryIdToTemplateId(templateA.secondaryId)}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
        },
      );

      expect(resB.ok()).toBeFalsy();
      expect(resB.status()).toBe(404);
    });

    test('should allow authorized access to template get endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const templateA = await seedBlankTemplate(userA, teamA.id);

      const resA = await request.get(
        `${WEBAPP_BASE_URL}/api/v1/templates/${mapSecondaryIdToTemplateId(templateA.secondaryId)}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
        },
      );

      expect(resA.ok()).toBeTruthy();
      expect(resA.status()).toBe(200);
    });
  });

  test.describe('Template DELETE endpoint', () => {
    test('should block unauthorized access to template delete endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const templateA = await seedBlankTemplate(userA, teamA.id);

      const resB = await request.delete(
        `${WEBAPP_BASE_URL}/api/v1/templates/${mapSecondaryIdToTemplateId(templateA.secondaryId)}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
        },
      );

      expect(resB.ok()).toBeFalsy();
      expect(resB.status()).toBe(404);
    });

    test('should allow authorized access to template delete endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const templateA = await seedBlankTemplate(userA, teamA.id);

      const resA = await request.delete(
        `${WEBAPP_BASE_URL}/api/v1/templates/${mapSecondaryIdToTemplateId(templateA.secondaryId)}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
        },
      );

      expect(resA.ok()).toBeTruthy();
      expect(resA.status()).toBe(200);
    });
  });

  test.describe('Document fields PATCH endpoint', () => {
    test('should block unauthorized access to PATCH on fields endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const { user: userRecipient } = await seedUser();
      const documentA = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const firstEnvelopeItem = documentA.envelopeItems[0];

      const recipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: documentA.id,
          email: userRecipient.email,
        },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: documentA.id,
          envelopeItemId: firstEnvelopeItem.id,
          recipientId: recipient!.id,
          type: FieldType.TEXT,
          page: 1,
          positionX: 5,
          positionY: 5,
          width: 10,
          height: 5,
          customText: '',
          inserted: false,
          fieldMeta: {
            type: 'text',
            label: 'Default Text Field',
          },
        },
      });

      const patchRes = await request.patch(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/fields/${field.id}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            recipientId: recipient!.id,
            type: FieldType.TEXT,
            pageNumber: 1,
            pageX: 99,
            pageY: 99,
            pageWidth: 99,
            pageHeight: 99,
            fieldMeta: {
              type: 'text',
              label: 'My new field',
            },
          },
        },
      );
      expect(patchRes.ok()).toBeFalsy();
      expect(patchRes.status()).toBe(401);
    });

    test('should allow authorized access to PATCH on fields endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const { user: userRecipient } = await seedUser();
      const documentA = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const firstEnvelopeItem = documentA.envelopeItems[0];

      const recipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: documentA.id,
          email: userRecipient.email,
        },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: documentA.id,
          envelopeItemId: firstEnvelopeItem.id,
          recipientId: recipient!.id,
          type: FieldType.TEXT,
          page: 1,
          positionX: 5,
          positionY: 5,
          width: 10,
          height: 5,
          customText: '',
          inserted: false,
          fieldMeta: {
            type: 'text',
            label: 'Default Text Field',
          },
        },
      });

      const patchRes = await request.patch(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/fields/${field.id}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            recipientId: recipient!.id,
            type: FieldType.TEXT,
            pageNumber: 1,
            pageX: 99,
            pageY: 99,
            pageWidth: 99,
            pageHeight: 99,
            fieldMeta: {
              type: 'text',
              label: 'My new field',
            },
          },
        },
      );
      expect(patchRes.ok()).toBeTruthy();
      expect(patchRes.status()).toBe(200);
    });
  });

  test.describe('Document fields DELETE endpoint', () => {
    test('should block unauthorized access to DELETE on fields endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const { user: userRecipient } = await seedUser();
      const documentA = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const firstEnvelopeItem = documentA.envelopeItems[0];

      const recipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: documentA.id,
          email: userRecipient.email,
        },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: documentA.id,
          envelopeItemId: firstEnvelopeItem.id,
          recipientId: recipient!.id,
          type: FieldType.NUMBER,
          page: 1,
          positionX: 5,
          positionY: 5,
          width: 10,
          height: 5,
          customText: '',
          inserted: false,
          fieldMeta: {
            type: 'number',
            label: 'Default Number Field',
          },
        },
      });

      const deleteRes = await request.delete(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/fields/${field.id}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {},
        },
      );

      expect(deleteRes.ok()).toBeFalsy();
      expect(deleteRes.status()).toBe(401);
    });

    test('should allow authorized access to DELETE on fields endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const { user: userRecipient } = await seedUser();
      const documentA = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const firstEnvelopeItem = documentA.envelopeItems[0];

      const recipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: documentA.id,
          email: userRecipient.email,
        },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: documentA.id,
          envelopeItemId: firstEnvelopeItem.id,
          recipientId: recipient!.id,
          type: FieldType.NUMBER,
          page: 1,
          positionX: 5,
          positionY: 5,
          width: 10,
          height: 5,
          customText: '',
          inserted: false,
          fieldMeta: {
            type: 'number',
            label: 'Default Number Field',
          },
        },
      });

      const deleteRes = await request.delete(
        `${WEBAPP_BASE_URL}/api/v1/documents/${mapSecondaryIdToDocumentId(documentA.secondaryId)}/fields/${field.id}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {},
        },
      );

      expect(deleteRes.ok()).toBeTruthy();
      expect(deleteRes.status()).toBe(200);
    });
  });

  test.describe('Documents list endpoint', () => {
    test('should block unauthorized access to documents list endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      await seedBlankDocument(userA, teamA.id);

      const resB = await request.get(`${WEBAPP_BASE_URL}/api/v1/documents`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });

      const reqData = await resB.json();

      expect(resB.ok()).toBeTruthy();
      expect(resB.status()).toBe(200);
      expect(reqData.documents.every((doc: { userId: number }) => doc.userId !== userA.id)).toBe(
        true,
      );
      expect(reqData.documents.length).toBe(0);
      expect(reqData.totalPages).toBe(0);
    });

    test('should allow authorized access to documents list endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      await seedBlankDocument(userA, teamA.id);

      const resA = await request.get(`${WEBAPP_BASE_URL}/api/v1/documents`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });

      const reqData = await resA.json();

      expect(resA.ok()).toBeTruthy();
      expect(resA.status()).toBe(200);
      expect(reqData.documents.length).toBeGreaterThan(0);
      expect(reqData.documents.every((doc: { userId: number }) => doc.userId === userA.id)).toBe(
        true,
      );
    });
  });

  test.describe('Templates list endpoint', () => {
    test('should block unauthorized access to templates list endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      await seedBlankTemplate(userA, teamA.id);

      const resB = await request.get(`${WEBAPP_BASE_URL}/api/v1/templates`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });

      const reqData = await resB.json();

      expect(resB.ok()).toBeTruthy();
      expect(resB.status()).toBe(200);
      expect(reqData.templates.every((tpl: { userId: number }) => tpl.userId !== userA.id)).toBe(
        true,
      );
      expect(reqData.templates.length).toBe(0);
      expect(reqData.totalPages).toBe(0);
    });

    test('should allow authorized access to templates list endpoint', async ({ request }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      await seedBlankTemplate(userA, teamA.id);

      const resA = await request.get(`${WEBAPP_BASE_URL}/api/v1/templates`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });

      const reqData = await resA.json();

      expect(resA.ok()).toBeTruthy();
      expect(resA.status()).toBe(200);
      expect(reqData.templates.length).toBeGreaterThan(0);
      expect(reqData.templates.every((tpl: { userId: number }) => tpl.userId === userA.id)).toBe(
        true,
      );
    });
  });

  test.describe('Create document from template endpoint', () => {
    test('should block unauthorized access to create-document-from-template endpoint', async ({
      request,
    }) => {
      const { user: userA, team: teamA } = await seedUser();

      const { user: userB, team: teamB } = await seedUser();
      const { token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      });

      const templateA = await seedTemplate({
        teamId: teamA.id,
        userId: userA.id,
      });

      const resB = await request.post(
        `${WEBAPP_BASE_URL}/api/v1/templates/${mapSecondaryIdToTemplateId(templateA.secondaryId)}/create-document`,
        {
          headers: {
            Authorization: `Bearer ${tokenB}`,
            'Content-Type': 'application/json',
          },
          data: {
            title: 'Should not work',
            recipients: [{ name: 'Test user', email: 'test@example.com' }],
            meta: {
              subject: 'Test',
              message: 'Test',
              timezone: 'UTC',
              dateFormat: 'yyyy-MM-dd',
              redirectUrl: 'https://example.com',
            },
          },
        },
      );

      expect(resB.ok()).toBeFalsy();
      expect(resB.status()).toBe(401);
    });

    test('should allow authorized access to create-document-from-template endpoint', async ({
      request,
    }) => {
      const { user: userA, team: teamA } = await seedUser();
      const { token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      });

      const templateA = await seedTemplate({
        teamId: teamA.id,
        userId: userA.id,
      });

      const resA = await request.post(
        `${WEBAPP_BASE_URL}/api/v1/templates/${mapSecondaryIdToTemplateId(templateA.secondaryId)}/create-document`,
        {
          headers: {
            Authorization: `Bearer ${tokenA}`,
            'Content-Type': 'application/json',
          },
          data: {
            title: 'Should work',
            recipients: [{ name: 'Test user', email: 'test@example.com' }],
            meta: {
              subject: 'Test',
              message: 'Test',
              timezone: 'UTC',
              dateFormat: 'yyyy-MM-dd',
              redirectUrl: 'https://example.com',
            },
          },
        },
      );

      expect(resA.ok()).toBeTruthy();
      expect(resA.status()).toBe(200);
    });
  });
});
