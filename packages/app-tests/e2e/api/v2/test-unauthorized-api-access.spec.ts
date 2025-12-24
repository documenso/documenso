import { expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { nanoid } from '@documenso/lib/universal/id';
import {
  mapSecondaryIdToDocumentId,
  mapSecondaryIdToTemplateId,
} from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import {
  DocumentStatus,
  DocumentVisibility,
  EnvelopeType,
  FieldType,
  FolderType,
  Prisma,
  ReadStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
  TeamMemberRole,
} from '@documenso/prisma/client';
import {
  seedBlankDocument,
  seedCompletedDocument,
  seedDraftDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate, seedTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TCreateEnvelopeItemsPayload } from '@documenso/trpc/server/envelope-router/create-envelope-items.types';
import type { TFindEnvelopesResponse } from '@documenso/trpc/server/envelope-router/find-envelopes.types';
import type {
  TUseEnvelopePayload,
  TUseEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/use-envelope.types';

import { apiSignin } from '../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

test.describe('Document API V2', () => {
  let userA: User, teamA: Team, userB: User, teamB: Team, tokenA: string, tokenB: string;

  test.beforeEach(async () => {
    ({ user: userA, team: teamA } = await seedUser());
    ({ token: tokenA } = await createApiToken({
      userId: userA.id,
      teamId: teamA.id,
      tokenName: 'userA',
      expiresIn: null,
    }));

    ({ user: userB, team: teamB } = await seedUser());
    ({ token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    }));
  });

  test.describe('Document list endpoint', () => {
    test('should block unauthorized access to document list endpoint', async ({ request }) => {
      await seedCompletedDocument(userA, teamA.id, ['test@example.com']);

      const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/document`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const data = await res.json();
      expect(data.data.every((doc: { userId: number }) => doc.userId !== userA.id)).toBe(true);
    });

    test('should allow authorized access to document list endpoint', async ({ request }) => {
      await seedCompletedDocument(userA, teamA.id, ['test@example.com']);

      const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/document`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const data = await res.json();
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data.every((doc: { userId: number }) => doc.userId === userA.id)).toBe(true);
    });
  });

  test.describe('Document detail endpoint', () => {
    test('should block unauthorized access to document detail endpoint', async ({ request }) => {
      const doc = await seedBlankDocument(userA, teamA.id);

      const res = await request.get(
        `${WEBAPP_BASE_URL}/api/v2-beta/document/${mapSecondaryIdToDocumentId(doc.secondaryId)}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
        },
      );

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document detail endpoint', async ({ request }) => {
      const doc = await seedBlankDocument(userA, teamA.id);

      const res = await request.get(
        `${WEBAPP_BASE_URL}/api/v2-beta/document/${mapSecondaryIdToDocumentId(doc.secondaryId)}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
        },
      );

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document update endpoint', () => {
    test('should block unauthorized access to document update endpoint', async ({ request }) => {
      const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/update`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          data: { title: 'Updated Title' },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document update endpoint', async ({ request }) => {
      const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/update`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          data: { title: 'Updated Title' },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document delete endpoint', () => {
    test('should block unauthorized access to document delete endpoint', async ({ request }) => {
      const doc = await seedDraftDocument(userA, teamA.id, []);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/delete`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { documentId: mapSecondaryIdToDocumentId(doc.secondaryId) },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(401);
    });

    test('should allow authorized access to document delete endpoint', async ({ request }) => {
      const doc = await seedDraftDocument(userA, teamA.id, []);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/delete`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { documentId: mapSecondaryIdToDocumentId(doc.secondaryId) },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document distribute endpoint', () => {
    test('should block unauthorized access to document distribute endpoint', async ({
      request,
    }) => {
      const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/distribute`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { documentId: mapSecondaryIdToDocumentId(doc.secondaryId) },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(500);
    });

    test('should allow authorized access to document distribute endpoint', async ({ request }) => {
      const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/distribute`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { documentId: mapSecondaryIdToDocumentId(doc.secondaryId) },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document redistribute endpoint', () => {
    test('should block unauthorized access to document redistribute endpoint', async ({
      request,
    }) => {
      const doc = await seedPendingDocument(userA, teamA.id, []);

      const userRecipient = await prisma.recipient.create({
        data: {
          email: 'test@example.com',
          name: 'Test',
          token: nanoid(),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
          signedAt: null,
          envelopeId: doc.id,
          fields: {
            create: {
              page: 1,
              type: FieldType.NAME,
              inserted: true,
              customText: '',
              positionX: new Prisma.Decimal(1),
              positionY: new Prisma.Decimal(1),
              width: new Prisma.Decimal(1),
              height: new Prisma.Decimal(1),
              envelopeId: doc.id,
              envelopeItemId: doc.envelopeItems[0].id,
            },
          },
        },
      });

      const recipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: doc.id,
          email: userRecipient.email,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/redistribute`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          recipients: [recipient!.id],
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(500);
    });

    test('should allow authorized access to document redistribute endpoint', async ({
      request,
    }) => {
      const doc = await seedPendingDocument(userA, teamA.id, []);

      const userRecipient = await prisma.recipient.create({
        data: {
          email: 'test@example.com',
          name: 'Test',
          token: nanoid(),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
          signedAt: null,
          envelopeId: doc.id,
          fields: {
            create: {
              page: 1,
              type: FieldType.NAME,
              inserted: true,
              customText: '',
              positionX: new Prisma.Decimal(1),
              positionY: new Prisma.Decimal(1),
              width: new Prisma.Decimal(1),
              height: new Prisma.Decimal(1),
              envelopeId: doc.id,
              envelopeItemId: doc.envelopeItems[0].id,
            },
          },
        },
      });

      const recipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: doc.id,
          email: userRecipient.email,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/redistribute`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          recipients: [recipient!.id],
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document duplicate endpoint', () => {
    test('should block unauthorized access to document duplicate endpoint', async ({ request }) => {
      const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/duplicate`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { documentId: mapSecondaryIdToDocumentId(doc.secondaryId) },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document duplicate endpoint', async ({ request }) => {
      const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/duplicate`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { documentId: mapSecondaryIdToDocumentId(doc.secondaryId) },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document field GET endpoint', () => {
    test('should block unauthorized access to document field endpoint', async ({ request }) => {
      const { user: userRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: doc.id,
          email: userRecipient.email,
        },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: doc.id,
          envelopeItemId: doc.envelopeItems[0].id,
          recipientId: recipient!.id,
          type: 'TEXT',
          page: 1,
          positionX: 1,
          positionY: 1,
          width: 1,
          height: 1,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'text', label: 'Test' },
        },
      });

      const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/${field.id}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document field endpoint', async ({ request }) => {
      const { user: userRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirstOrThrow({
        where: {
          envelopeId: doc.id,
          email: userRecipient.email,
        },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: doc.id,
          envelopeItemId: doc.envelopeItems[0].id,
          recipientId: recipient.id,
          type: 'TEXT',
          page: 1,
          positionX: 1,
          positionY: 1,
          width: 1,
          height: 1,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'text', label: 'Test' },
        },
      });

      const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/${field.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document field create endpoint', () => {
    test('should block unauthorized access to document field create endpoint', async ({
      request,
    }) => {
      const { user: userRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/create`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          field: {
            recipientId: recipient!.id,
            type: 'TEXT',
            pageNumber: 791.77,
            pageX: 7845.22,
            pageY: 6843.16,
            width: 3932.15,
            height: 8879.89,
            fieldMeta: { type: 'text', label: 'Test Field' },
          },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect([404, 401, 500]).toContain(res.status());
    });

    test('should allow authorized access to document field create endpoint', async ({
      request,
    }) => {
      const { user: userRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/create`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          field: {
            recipientId: recipient!.id,
            type: 'TEXT',
            pageNumber: 791.77,
            pageX: 7845.22,
            pageY: 6843.16,
            width: 3932.15,
            height: 8879.89,
            fieldMeta: { type: 'text', label: 'Test Field' },
          },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document field create-many endpoint', () => {
    test('should block unauthorized access to document field create-many endpoint', async ({
      request,
    }) => {
      const { user: userRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/create-many`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          fields: [
            {
              recipientId: recipient!.id,
              type: 'TEXT',
              pageNumber: 791.77,
              pageX: 7845.22,
              pageY: 6843.16,
              width: 3932.15,
              height: 8879.89,
              fieldMeta: { type: 'text', label: 'First test field' },
            },
            {
              recipientId: recipient!.id,
              type: 'TEXT',
              pageNumber: 791.77,
              pageX: 845.22,
              pageY: 843.16,
              width: 932.15,
              height: 879.89,
              fieldMeta: { type: 'text', label: 'Second test field' },
            },
          ],
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document field create-many endpoint', async ({
      request,
    }) => {
      const { user: userRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/create-many`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          fields: [
            {
              recipientId: recipient!.id,
              type: 'TEXT',
              pageNumber: 791.77,
              pageX: 7845.22,
              pageY: 6843.16,
              width: 3932.15,
              height: 8879.89,
              fieldMeta: { type: 'text', label: 'First test field' },
            },
            {
              recipientId: recipient!.id,
              type: 'TEXT',
              pageNumber: 791.77,
              pageX: 845.22,
              pageY: 843.16,
              width: 932.15,
              height: 879.89,
              fieldMeta: { type: 'text', label: 'Second test field' },
            },
          ],
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document field update endpoint', () => {
    test('should block unauthorized access to document field update endpoint', async ({
      request,
    }) => {
      const { user: userRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: doc.id,
          envelopeItemId: doc.envelopeItems[0].id,
          recipientId: recipient!.id,
          type: 'TEXT',
          page: 1,
          positionX: 1,
          positionY: 1,
          width: 1,
          height: 1,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'text', label: 'A text field' },
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/update`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          field: {
            id: field.id,
            type: FieldType.TEXT,
            fieldMeta: { type: 'text', label: 'An updated text field' },
          },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document field update endpoint', async ({
      request,
    }) => {
      const { user: userRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: doc.id,
          envelopeItemId: doc.envelopeItems[0].id,
          recipientId: recipient!.id,
          type: 'TEXT',
          page: 1,
          positionX: 1,
          positionY: 1,
          width: 1,
          height: 1,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'text', label: 'A text field' },
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/update`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          field: {
            id: field.id,
            type: FieldType.TEXT,
            fieldMeta: { type: 'text', label: 'An updated text field' },
          },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document field update-many endpoint', () => {
    test('should block unauthorized access to document field update-many endpoint', async ({
      request,
    }) => {
      const { user: userRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const fields = await prisma.field.createManyAndReturn({
        data: [
          {
            envelopeId: doc.id,
            envelopeItemId: doc.envelopeItems[0].id,
            recipientId: recipient!.id,
            type: FieldType.TEXT,
            page: 1,
            positionX: 1,
            positionY: 1,
            width: 1,
            height: 1,
            customText: '',
            inserted: false,
            fieldMeta: { type: 'text', label: 'Test' },
          },
          {
            envelopeId: doc.id,
            envelopeItemId: doc.envelopeItems[0].id,
            recipientId: recipient!.id,
            type: FieldType.NUMBER,
            page: 1,
            positionX: 1,
            positionY: 1,
            width: 1,
            height: 1,
            customText: '',
            inserted: false,
            fieldMeta: { type: 'text', label: 'Test' },
          },
        ],
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/update-many`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          fields: [
            {
              id: fields[0].id,
              type: FieldType.TEXT,
              fieldMeta: { type: 'text', label: 'Updated first test field' },
            },
            {
              id: fields[1].id,
              type: FieldType.NUMBER,
              fieldMeta: { type: 'number', label: 'Updated second test field' },
            },
          ],
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document field update-many endpoint', async ({
      request,
    }) => {
      const { user: userRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const fields = await prisma.field.createManyAndReturn({
        data: [
          {
            envelopeId: doc.id,
            envelopeItemId: doc.envelopeItems[0].id,
            recipientId: recipient!.id,
            type: FieldType.TEXT,
            page: 1,
            positionX: 1,
            positionY: 1,
            width: 1,
            height: 1,
            customText: '',
            inserted: false,
            fieldMeta: { type: 'text', label: 'Test' },
          },
          {
            envelopeId: doc.id,
            envelopeItemId: doc.envelopeItems[0].id,
            recipientId: recipient!.id,
            type: FieldType.NUMBER,
            page: 1,
            positionX: 1,
            positionY: 1,
            width: 1,
            height: 1,
            customText: '',
            inserted: false,
            fieldMeta: { type: 'text', label: 'Test' },
          },
        ],
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/update-many`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          fields: [
            {
              id: fields[0].id,
              type: FieldType.TEXT,
              fieldMeta: { type: 'text', label: 'Updated first test field' },
            },
            {
              id: fields[1].id,
              type: FieldType.NUMBER,
              fieldMeta: { type: 'number', label: 'Updated second test field' },
            },
          ],
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document field delete endpoint', () => {
    test('should block unauthorized access to document field delete endpoint', async ({
      request,
    }) => {
      const { user: userRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: doc.id,
          envelopeItemId: doc.envelopeItems[0].id,
          recipientId: recipient!.id,
          type: FieldType.TEXT,
          page: 1,
          positionX: 1,
          positionY: 1,
          width: 1,
          height: 1,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'text', label: 'Test' },
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/delete`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { fieldId: field.id },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document field delete endpoint', async ({
      request,
    }) => {
      const { user: userRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: doc.id,
          envelopeItemId: doc.envelopeItems[0].id,
          recipientId: recipient!.id,
          type: FieldType.TEXT,
          page: 1,
          positionX: 1,
          positionY: 1,
          width: 1,
          height: 1,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'text', label: 'Test' },
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/delete`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { fieldId: field.id },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template field create endpoint', () => {
    test('should block unauthorized access to template field create endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/field/create`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          field: {
            recipientId: recipient.id,
            type: FieldType.TEXT,
            pageNumber: 5735.12,
            pageX: 936.28,
            pageY: 594.41,
            width: 589.39,
            height: 122.23,
            fieldMeta: { type: 'text', label: 'Test' },
          },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template field create endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/field/create`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          field: {
            recipientId: recipient.id,
            type: FieldType.TEXT,
            pageNumber: 5735.12,
            pageX: 936.28,
            pageY: 594.41,
            width: 589.39,
            height: 122.23,
            fieldMeta: { type: 'text', label: 'Test' },
          },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template field GET endpoint', () => {
    test('should block unauthorized access to template field get field endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: template.id,
          envelopeItemId: template.envelopeItems[0].id,
          recipientId: recipient.id,
          type: FieldType.TEXT,
          page: 1,
          positionX: 936.28,
          positionY: 594.41,
          width: 589.39,
          height: 122.23,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'text', label: 'New test field' },
        },
      });

      const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/template/field/${field.id}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template field get field endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: template.id,
          envelopeItemId: template.envelopeItems[0].id,
          recipientId: recipient.id,
          type: FieldType.TEXT,
          page: 1,
          positionX: 936.28,
          positionY: 594.41,
          width: 589.39,
          height: 122.23,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'text', label: 'New test field' },
        },
      });

      const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/template/field/${field.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template field create-many endpoint', () => {
    test('should block unauthorized access to template field create-many endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const secondRecipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test2@example.com',
          name: 'Test 2',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/field/create-many`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          fields: [
            {
              recipientId: recipient.id,
              type: FieldType.TEXT,
              pageNumber: 1,
              pageX: 1,
              pageY: 1,
              width: 1,
              height: 1,
              fieldMeta: { type: 'text', label: 'Test' },
            },
            {
              recipientId: secondRecipient.id,
              type: FieldType.NUMBER,
              pageNumber: 1,
              pageX: 1,
              pageY: 1,
              width: 1,
              height: 1,
              fieldMeta: { type: 'number', label: 'Test 2' },
            },
          ],
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template field create-many endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const secondRecipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test2@example.com',
          name: 'Test 2',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/field/create-many`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          fields: [
            {
              recipientId: recipient.id,
              type: FieldType.TEXT,
              pageNumber: 1,
              pageX: 1,
              pageY: 1,
              width: 1,
              height: 1,
              fieldMeta: { type: 'text', label: 'Test' },
            },
            {
              recipientId: secondRecipient.id,
              type: FieldType.NUMBER,
              pageNumber: 1,
              pageX: 1,
              pageY: 1,
              width: 1,
              height: 1,
              fieldMeta: { type: 'number', label: 'Test 2' },
            },
          ],
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template field update endpoint', () => {
    test('should block unauthorized access to template field update endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: template.id,
          envelopeItemId: template.envelopeItems[0].id,
          recipientId: recipient.id,
          type: FieldType.TEXT,
          page: 1,
          positionX: 1,
          positionY: 1,
          width: 1,
          height: 1,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'text', label: 'Test field to update' },
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/field/update`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          field: {
            id: field.id,
            type: FieldType.TEXT,
            fieldMeta: { type: 'text', label: 'Updated field' },
          },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template field update endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: template.id,
          envelopeItemId: template.envelopeItems[0].id,
          recipientId: recipient.id,
          type: FieldType.TEXT,
          page: 1,
          positionX: 1,
          positionY: 1,
          width: 1,
          height: 1,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'text', label: 'Test field to update' },
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/field/update`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          field: {
            id: field.id,
            type: FieldType.TEXT,
            fieldMeta: { type: 'text', label: 'Updated field' },
          },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template field update-many endpoint', () => {
    test('should block unauthorized access to template field update-many endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const field = await prisma.field.createManyAndReturn({
        data: [
          {
            envelopeId: template.id,
            envelopeItemId: template.envelopeItems[0].id,
            recipientId: recipient.id,
            type: 'TEXT',
            page: 1,
            positionX: 1,
            positionY: 1,
            width: 1,
            height: 1,
            customText: '',
            inserted: false,
            fieldMeta: { type: 'text', label: 'Test field to update' },
          },
          {
            envelopeId: template.id,
            envelopeItemId: template.envelopeItems[0].id,
            recipientId: recipient.id,
            type: FieldType.NUMBER,
            page: 1,
            positionX: 1,
            positionY: 1,
            width: 1,
            height: 1,
            customText: '',
            inserted: false,
            fieldMeta: { type: 'number', label: 'Test field to update' },
          },
        ],
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/field/update-many`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          fields: [
            {
              id: field[0].id,
              type: FieldType.TEXT,
              fieldMeta: { type: 'text', label: 'Updated first field - text' },
            },
            {
              id: field[1].id,
              type: FieldType.NUMBER,
              fieldMeta: { type: 'number', label: 'Updated second field - number' },
            },
          ],
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template field update-many endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const field = await prisma.field.createManyAndReturn({
        data: [
          {
            envelopeId: template.id,
            envelopeItemId: template.envelopeItems[0].id,
            recipientId: recipient.id,
            type: 'TEXT',
            page: 1,
            positionX: 1,
            positionY: 1,
            width: 1,
            height: 1,
            customText: '',
            inserted: false,
            fieldMeta: { type: 'text', label: 'Test field to update' },
          },
          {
            envelopeId: template.id,
            envelopeItemId: template.envelopeItems[0].id,
            recipientId: recipient.id,
            type: FieldType.NUMBER,
            page: 1,
            positionX: 1,
            positionY: 1,
            width: 1,
            height: 1,
            customText: '',
            inserted: false,
            fieldMeta: { type: 'number', label: 'Test field to update' },
          },
        ],
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/field/update-many`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          fields: [
            {
              id: field[0].id,
              type: FieldType.TEXT,
              fieldMeta: { type: 'text', label: 'Updated first field - text' },
            },
            {
              id: field[1].id,
              type: FieldType.NUMBER,
              fieldMeta: { type: 'number', label: 'Updated second field - number' },
            },
          ],
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template field delete endpoint', () => {
    test('should block unauthorized access to template field delete endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: template.id,
          envelopeItemId: template.envelopeItems[0].id,
          recipientId: recipient.id,
          type: 'TEXT',
          page: 1,
          positionX: 1,
          positionY: 1,
          width: 1,
          height: 1,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'text', label: 'Test field to delete' },
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/field/delete`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { fieldId: field.id },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template field delete endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const field = await prisma.field.create({
        data: {
          envelopeId: template.id,
          envelopeItemId: template.envelopeItems[0].id,
          recipientId: recipient.id,
          type: 'TEXT',
          page: 1,
          positionX: 1,
          positionY: 1,
          width: 1,
          height: 1,
          customText: '',
          inserted: false,
          fieldMeta: { type: 'text', label: 'Test field to delete' },
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/field/delete`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { fieldId: field.id },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document recipient GET endpoint', () => {
    test('should block unauthorized access to document recipient get endpoint', async ({
      request,
    }) => {
      const { user: recipientUser } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const res = await request.get(
        `${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/${recipient!.id}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
        },
      );

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document recipient get endpoint', async ({
      request,
    }) => {
      const { user: recipientUser } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const res = await request.get(
        `${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/${recipient!.id}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
        },
      );

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document recipient create endpoint', () => {
    test('should block unauthorized access to document recipient create endpoint', async ({
      request,
    }) => {
      const doc = await seedDraftDocument(userA, teamA.id, []);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/create`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          recipient: {
            name: 'Test',
            email: 'test@example.com',
            role: RecipientRole.SIGNER,
          },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document recipient create endpoint', async ({
      request,
    }) => {
      const doc = await seedDraftDocument(userA, teamA.id, []);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/create`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          recipient: {
            name: 'Test',
            email: 'test@example.com',
            role: RecipientRole.SIGNER,
          },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document recipient create-many endpoint', () => {
    test('should block unauthorized access to document recipient create-many endpoint', async ({
      request,
    }) => {
      const doc = await seedDraftDocument(userA, teamA.id, []);

      const res = await request.post(
        `${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/create-many`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
            recipients: [
              {
                name: 'Test',
                email: 'test@example.com',
                role: RecipientRole.SIGNER,
              },
              {
                name: 'Test 2',
                email: 'test2@example.com',
                role: RecipientRole.SIGNER,
              },
            ],
          },
        },
      );

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document recipient create-many endpoint', async ({
      request,
    }) => {
      const doc = await seedDraftDocument(userA, teamA.id, []);

      const res = await request.post(
        `${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/create-many`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
            recipients: [
              {
                name: 'Test',
                email: 'test@example.com',
                role: RecipientRole.SIGNER,
              },
              {
                name: 'Test 2',
                email: 'test2@example.com',
                role: RecipientRole.SIGNER,
              },
            ],
          },
        },
      );

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document recipient update endpoint', () => {
    test('should block unauthorized access to document recipient update endpoint', async ({
      request,
    }) => {
      const { user: recipientUser } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/update`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          recipient: {
            id: recipient!.id,
            name: 'Updated recipient',
          },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document recipient update endpoint', async ({
      request,
    }) => {
      const { user: recipientUser } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/update`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
          recipient: {
            id: recipient!.id,
            name: 'Updated recipient',
          },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document recipient update-many endpoint', () => {
    test('should block unauthorized access to document recipient update-many endpoint', async ({
      request,
    }) => {
      const { user: firstRecipient } = await seedUser();
      const { user: secondRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [firstRecipient, secondRecipient]);

      const firstDocumentRecipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: doc.id,
          email: firstRecipient.email,
        },
      });

      const secondDocumentRecipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: doc.id,
          email: secondRecipient.email,
        },
      });

      const res = await request.post(
        `${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/update-many`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
            recipients: [
              {
                id: firstDocumentRecipient!.id,
                name: 'Updated first recipient',
              },
              {
                id: secondDocumentRecipient!.id,
                name: 'Updated second recipient',
              },
            ],
          },
        },
      );

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document recipient update-many endpoint', async ({
      request,
    }) => {
      const { user: firstRecipient } = await seedUser();
      const { user: secondRecipient } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [firstRecipient, secondRecipient]);

      const firstDocumentRecipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: doc.id,
          email: firstRecipient.email,
        },
      });

      const secondDocumentRecipient = await prisma.recipient.findFirst({
        where: {
          envelopeId: doc.id,
          email: secondRecipient.email,
        },
      });

      const res = await request.post(
        `${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/update-many`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            documentId: mapSecondaryIdToDocumentId(doc.secondaryId),
            recipients: [
              {
                id: firstDocumentRecipient!.id,
                name: 'Updated first recipient',
              },
              {
                id: secondDocumentRecipient!.id,
                name: 'Updated second recipient',
              },
            ],
          },
        },
      );

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document recipient delete endpoint', () => {
    test('should block unauthorized access to document recipient delete endpoint', async ({
      request,
    }) => {
      const { user: recipientUser } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/delete`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { recipientId: recipient!.id },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to document recipient delete endpoint', async ({
      request,
    }) => {
      const { user: recipientUser } = await seedUser();

      const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

      const recipient = await prisma.recipient.findFirst({
        where: { envelopeId: doc.id },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/delete`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { recipientId: recipient!.id },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template recipient GET endpoint', () => {
    test('should block unauthorized access to template recipient get endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const templateRecipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test wuth',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const res = await request.get(
        `${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/${templateRecipient.id}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
        },
      );

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template recipient get endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const templateRecipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test wuth',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const res = await request.get(
        `${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/${templateRecipient.id}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
        },
      );

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template recipient create endpoint', () => {
    test('should block unauthorized access to template recipient create endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/create`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          recipient: {
            name: 'Test',
            email: 'test@example.com',
            role: RecipientRole.SIGNER,
          },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template recipient create endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/create`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          recipient: {
            name: 'Test',
            email: 'test@example.com',
            role: RecipientRole.SIGNER,
          },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template recipient create-many endpoint', () => {
    test('should block unauthorized access to template recipient create-many endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.post(
        `${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/create-many`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            templateId: mapSecondaryIdToTemplateId(template.secondaryId),
            recipients: [
              {
                name: 'Test first recipient',
                email: 'test-first-recipient@example.com',
                role: RecipientRole.SIGNER,
              },
              {
                name: 'Test second recipient',
                email: 'test-second-recipient@example.com',
                role: RecipientRole.SIGNER,
              },
            ],
          },
        },
      );

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template recipient create-many endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.post(
        `${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/create-many`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            templateId: mapSecondaryIdToTemplateId(template.secondaryId),
            recipients: [
              {
                name: 'Test first recipient',
                email: 'test-first-recipient@example.com',
                role: RecipientRole.SIGNER,
              },
              {
                name: 'Test second recipient',
                email: 'test-second-recipient@example.com',
                role: RecipientRole.SIGNER,
              },
            ],
          },
        },
      );

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template recipient update endpoint', () => {
    test('should block unauthorized access to template recipient update endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/update`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          recipient: {
            id: recipient.id,
            name: 'Updated test name',
          },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template recipient update endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/update`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          recipient: {
            id: recipient.id,
            name: 'Updated test name',
          },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template recipient update-many endpoint', () => {
    test('should block unauthorized access to template recipient update-many endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipients = await prisma.recipient.createManyAndReturn({
        data: [
          {
            envelopeId: template.id,
            email: 'test@example.com',
            name: 'Test',
            token: nanoid(12),
            readStatus: ReadStatus.NOT_OPENED,
            sendStatus: SendStatus.NOT_SENT,
            signingStatus: SigningStatus.NOT_SIGNED,
          },
          {
            envelopeId: template.id,
            email: 'test2@example.com',
            name: 'Test 2',
            token: nanoid(12),
            readStatus: ReadStatus.NOT_OPENED,
            sendStatus: SendStatus.NOT_SENT,
            signingStatus: SigningStatus.NOT_SIGNED,
          },
        ],
      });

      const res = await request.post(
        `${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/update-many`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            templateId: mapSecondaryIdToTemplateId(template.secondaryId),
            recipients: [
              {
                id: recipients[0].id,
                name: 'Updated test first recipient name',
              },
              {
                id: recipients[1].id,
                name: 'Updated test second recipient name',
              },
            ],
          },
        },
      );

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template recipient update-many endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipients = await prisma.recipient.createManyAndReturn({
        data: [
          {
            envelopeId: template.id,
            email: 'test@example.com',
            name: 'Test',
            token: nanoid(12),
            readStatus: ReadStatus.NOT_OPENED,
            sendStatus: SendStatus.NOT_SENT,
            signingStatus: SigningStatus.NOT_SIGNED,
          },
          {
            envelopeId: template.id,
            email: 'test2@example.com',
            name: 'Test 2',
            token: nanoid(12),
            readStatus: ReadStatus.NOT_OPENED,
            sendStatus: SendStatus.NOT_SENT,
            signingStatus: SigningStatus.NOT_SIGNED,
          },
        ],
      });

      const res = await request.post(
        `${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/update-many`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            templateId: mapSecondaryIdToTemplateId(template.secondaryId),
            recipients: [
              {
                id: recipients[0].id,
                name: 'Updated test first recipient name',
              },
              {
                id: recipients[1].id,
                name: 'Updated test second recipient name',
              },
            ],
          },
        },
      );

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template recipient delete endpoint', () => {
    test('should block unauthorized access to template recipient delete endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/delete`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { recipientId: recipient.id },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template recipient delete endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          email: 'test@example.com',
          name: 'Test',
          role: RecipientRole.SIGNER,
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/delete`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { recipientId: recipient.id },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template list endpoint', () => {
    test('should block unauthorized access to template list endpoint', async ({ request }) => {
      await seedBlankTemplate(userA, teamA.id);

      const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/template`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const data = await res.json();
      expect(data.data.every((doc: { userId: number }) => doc.userId !== userA.id)).toBe(true);
    });

    test('should allow authorized access to template list endpoint', async ({ request }) => {
      await seedBlankTemplate(userA, teamA.id);

      const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/template`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const data = await res.json();
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data.every((doc: { userId: number }) => doc.userId === userA.id)).toBe(true);
    });
  });

  test.describe('Template GET endpoint', () => {
    test('should block unauthorized access to template get endpoint', async ({ request }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.get(
        `${WEBAPP_BASE_URL}/api/v2-beta/template/${mapSecondaryIdToTemplateId(template.secondaryId)}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
        },
      );

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template get endpoint', async ({ request }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.get(
        `${WEBAPP_BASE_URL}/api/v2-beta/template/${mapSecondaryIdToTemplateId(template.secondaryId)}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
        },
      );

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template update endpoint', () => {
    test('should block unauthorized access to template update endpoint', async ({ request }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/update`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          data: {
            title: 'Updated template title',
            visibility: DocumentVisibility.MANAGER_AND_ABOVE,
          },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template update endpoint', async ({ request }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/update`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          data: {
            title: 'Updated template title',
            visibility: DocumentVisibility.MANAGER_AND_ABOVE,
          },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template duplicate endpoint', () => {
    test('should block unauthorized access to template duplicate endpoint', async ({ request }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/duplicate`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { templateId: mapSecondaryIdToTemplateId(template.secondaryId) },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template duplicate endpoint', async ({ request }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/duplicate`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { templateId: mapSecondaryIdToTemplateId(template.secondaryId) },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template delete endpoint', () => {
    test('should block unauthorized access to template delete endpoint', async ({ request }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/delete`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { templateId: mapSecondaryIdToTemplateId(template.secondaryId) },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(500);
    });

    test('should allow authorized access to template delete endpoint', async ({ request }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/delete`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { templateId: mapSecondaryIdToTemplateId(template.secondaryId) },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template use endpoint', () => {
    test('should block unauthorized access to template use endpoint', async ({ request }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const { user: firstRecipientUser } = await seedUser();
      const { user: secondRecipientUser } = await seedUser();

      const updatedTemplate = await prisma.envelope.update({
        where: { id: template.id },
        data: {
          recipients: {
            create: [
              {
                name: firstRecipientUser.name || '',
                email: firstRecipientUser.email,
                token: nanoid(12),
                readStatus: ReadStatus.NOT_OPENED,
                sendStatus: SendStatus.NOT_SENT,
                signingStatus: SigningStatus.NOT_SIGNED,
              },
              {
                name: secondRecipientUser.name || '',
                email: secondRecipientUser.email,
                token: nanoid(12),
                readStatus: ReadStatus.NOT_OPENED,
                sendStatus: SendStatus.NOT_SENT,
                signingStatus: SigningStatus.NOT_SIGNED,
              },
            ],
          },
        },
        include: {
          recipients: true,
        },
      });

      const recipientAId = updatedTemplate.recipients.find(
        (recipient) => recipient.email === firstRecipientUser.email,
      )?.id;
      const recipientBId = updatedTemplate.recipients.find(
        (recipient) => recipient.email === secondRecipientUser.email,
      )?.id;

      if (!recipientAId || !recipientBId) {
        throw new Error('Recipient IDs not found');
      }

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/use`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          recipients: [
            {
              id: recipientAId,
              name: firstRecipientUser.name,
              email: firstRecipientUser.email,
              role: RecipientRole.SIGNER,
            },
            {
              id: recipientBId,
              name: secondRecipientUser.name,
              email: secondRecipientUser.email,
              role: RecipientRole.SIGNER,
            },
          ],
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template use endpoint', async ({ request }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const { user: firstRecipientUser } = await seedUser();
      const { user: secondRecipientUser } = await seedUser();

      const updatedTemplate = await prisma.envelope.update({
        where: { id: template.id },
        data: {
          recipients: {
            create: [
              {
                name: firstRecipientUser.name || '',
                email: firstRecipientUser.email,
                token: nanoid(12),
                readStatus: ReadStatus.NOT_OPENED,
                sendStatus: SendStatus.NOT_SENT,
                signingStatus: SigningStatus.NOT_SIGNED,
              },
              {
                name: secondRecipientUser.name || '',
                email: secondRecipientUser.email,
                token: nanoid(12),
                readStatus: ReadStatus.NOT_OPENED,
                sendStatus: SendStatus.NOT_SENT,
                signingStatus: SigningStatus.NOT_SIGNED,
              },
            ],
          },
        },
        include: {
          recipients: true,
        },
      });

      const recipientAId = updatedTemplate.recipients.find(
        (recipient) => recipient.email === firstRecipientUser.email,
      )?.id;
      const recipientBId = updatedTemplate.recipients.find(
        (recipient) => recipient.email === secondRecipientUser.email,
      )?.id;

      if (!recipientAId || !recipientBId) {
        throw new Error('Recipient IDs not found');
      }

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/use`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          recipients: [
            {
              id: recipientAId,
              name: firstRecipientUser.name,
              email: firstRecipientUser.email,
              role: RecipientRole.SIGNER,
            },
            {
              id: recipientBId,
              name: secondRecipientUser.name,
              email: secondRecipientUser.email,
              role: RecipientRole.SIGNER,
            },
          ],
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template direct create endpoint', () => {
    test('should block unauthorized access to template direct create endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/direct/create`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { templateId: mapSecondaryIdToTemplateId(template.secondaryId) },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template direct create endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/direct/create`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { templateId: mapSecondaryIdToTemplateId(template.secondaryId) },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template direct delete endpoint', () => {
    test('should block unauthorized access to template direct delete endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          name: 'Test',
          email: 'test@example.com',
          token: nanoid(12),
        },
      });

      await prisma.templateDirectLink.create({
        data: {
          envelopeId: template.id,
          enabled: true,
          token: nanoid(12),
          directTemplateRecipientId: recipient.id,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/direct/delete`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { templateId: mapSecondaryIdToTemplateId(template.secondaryId) },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template direct delete endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          name: 'Test',
          email: 'test@example.com',
          token: nanoid(12),
        },
      });

      await prisma.templateDirectLink.create({
        data: {
          envelopeId: template.id,
          enabled: true,
          token: nanoid(12),
          directTemplateRecipientId: recipient.id,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/direct/delete`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { templateId: mapSecondaryIdToTemplateId(template.secondaryId) },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Template direct toggle endpoint', () => {
    test('should block unauthorized access to template direct toggle endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          name: 'Test',
          email: 'test@example.com',
          token: nanoid(12),
        },
      });

      await prisma.templateDirectLink.create({
        data: {
          envelopeId: template.id,
          enabled: true,
          token: nanoid(12),
          directTemplateRecipientId: recipient.id,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/direct/toggle`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { templateId: mapSecondaryIdToTemplateId(template.secondaryId), enabled: false },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to template direct toggle endpoint', async ({
      request,
    }) => {
      const template = await seedBlankTemplate(userA, teamA.id);

      const recipient = await prisma.recipient.create({
        data: {
          envelopeId: template.id,
          name: 'Test',
          email: 'test@example.com',
          token: nanoid(12),
        },
      });

      await prisma.templateDirectLink.create({
        data: {
          envelopeId: template.id,
          enabled: true,
          token: nanoid(12),
          directTemplateRecipientId: recipient.id,
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/direct/toggle`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { templateId: mapSecondaryIdToTemplateId(template.secondaryId), enabled: false },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Folder list endpoint', () => {
    test('should block unauthorized access to folder list endpoint', async ({ request }) => {
      await seedBlankFolder(userA, teamA.id);
      await seedBlankFolder(userA, teamA.id);

      const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/folder`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const { data } = await res.json();
      expect(data.every((folder: { userId: number }) => folder.userId !== userA.id)).toBe(true);
      expect(data.length).toBe(0);
    });

    test('should allow authorized access to folder list endpoint', async ({ request }) => {
      await seedBlankFolder(userA, teamA.id);
      await seedBlankFolder(userA, teamA.id);

      // Other team folders should not be visible.
      await seedBlankFolder(userA, teamB.id);
      await seedBlankFolder(userA, teamB.id);

      // Other team and user folders should not be visible.
      await seedBlankFolder(userB, teamB.id);
      await seedBlankFolder(userB, teamB.id);

      const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/folder`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const { data } = await res.json();

      expect(data.length).toBe(2);
      expect(data.every((folder: { userId: number }) => folder.userId === userA.id)).toBe(true);
    });
  });

  test.describe('Folder create endpoint', () => {
    test('should block unauthorized access to folder create endpoint', async ({ request }) => {
      const unauthorizedFolder = await seedBlankFolder(userB, teamB.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/folder/create`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          parentId: unauthorizedFolder.id,
          name: 'Test Folder',
          type: 'DOCUMENT',
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to folder create endpoint', async ({ request }) => {
      const authorizedFolder = await seedBlankFolder(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/folder/create`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          parentId: authorizedFolder.id,
          name: 'Test Folder',
          type: 'DOCUMENT',
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const noParentRes = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/folder/create`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          name: 'Test Folder',
          type: 'DOCUMENT',
        },
      });

      expect(noParentRes.ok()).toBeTruthy();
      expect(noParentRes.status()).toBe(200);
    });
  });

  test.describe('Folder update endpoint', () => {
    test('should block unauthorized access to folder update endpoint', async ({ request }) => {
      const folder = await seedBlankFolder(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/folder/update`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          folderId: folder.id,
          data: {
            name: 'Updated Folder Name',
          },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to folder update endpoint', async ({ request }) => {
      const folder = await seedBlankFolder(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/folder/update`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          folderId: folder.id,
          data: {
            name: 'Updated Folder Name',
          },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Folder delete endpoint', () => {
    test('should block unauthorized access to folder delete endpoint', async ({ request }) => {
      const folder = await seedBlankFolder(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/folder/delete`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { folderId: folder.id },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to folder delete endpoint', async ({ request }) => {
      const folder = await seedBlankFolder(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/folder/delete`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { folderId: folder.id },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Document create endpoint', () => {
    test('should allow authorized access to document create endpoint', async ({ request }) => {
      const payload = {
        title: 'Test Document',
      };

      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));

      const pdfPath = path.join(__dirname, '../../../../../assets/example.pdf');
      const pdfData = fs.existsSync(pdfPath) ? fs.readFileSync(pdfPath) : Buffer.from('%PDF-1.4\n');

      formData.append('file', new File([pdfData], 'test.pdf', { type: 'application/pdf' }));

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/create`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        multipart: formData,
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const data = await res.json();
      expect(data.envelopeId).toBeDefined();
      expect(data.id).toBeDefined();

      const envelope = await prisma.envelope.findFirstOrThrow({
        where: {
          id: data.envelopeId,
        },
        include: {
          envelopeItems: true,
        },
      });

      expect(envelope?.title).toBe(payload.title);
      expect(envelope.envelopeItems.length).toBe(1);
    });
  });

  test.describe('Template create endpoint', () => {
    test('should allow authorized access to template create endpoint', async ({ request }) => {
      const payload = {
        title: 'Test Template',
      };

      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));

      const pdfPath = path.join(__dirname, '../../../../../assets/example.pdf');
      const pdfData = fs.existsSync(pdfPath) ? fs.readFileSync(pdfPath) : Buffer.from('%PDF-1.4\n');

      formData.append('file', new File([pdfData], 'test.pdf', { type: 'application/pdf' }));

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/create`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        multipart: formData,
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const data = await res.json();
      expect(data.envelopeId).toBeDefined();
      expect(data.id).toBeDefined();

      const envelope = await prisma.envelope.findFirstOrThrow({
        where: {
          id: data.envelopeId,
        },
        include: {
          envelopeItems: true,
        },
      });

      expect(envelope.title).toBe(payload.title);
      expect(envelope.envelopeItems.length).toBe(1);
    });
  });

  test.describe('Envelope API V2', () => {
    let userA: User, teamA: Team, userB: User, teamB: Team, tokenA: string, tokenB: string;

    test.beforeEach(async () => {
      ({ user: userA, team: teamA } = await seedUser());
      ({ token: tokenA } = await createApiToken({
        userId: userA.id,
        teamId: teamA.id,
        tokenName: 'userA',
        expiresIn: null,
      }));

      ({ user: userB, team: teamB } = await seedUser());
      ({ token: tokenB } = await createApiToken({
        userId: userB.id,
        teamId: teamB.id,
        tokenName: 'userB',
        expiresIn: null,
      }));
    });

    test.describe('Envelope get endpoint', () => {
      test('should block unauthorized access to envelope get endpoint', async ({ request }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/${doc.id}`, {
          headers: { Authorization: `Bearer ${tokenB}` },
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope get endpoint', async ({ request }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/${doc.id}`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope get-many endpoint', () => {
      test('should block unauthorized access to envelope get-many endpoint', async ({
        request,
      }) => {
        const doc1 = await seedBlankDocument(userA, teamA.id);
        const doc2 = await seedBlankDocument(userA, teamA.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/get-many`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            ids: {
              type: 'envelopeId',
              ids: [doc1.id, doc2.id],
            },
          },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const { data } = await res.json();
        expect(data).toEqual([]);
      });

      test('should allow authorized access to envelope get-many endpoint', async ({ request }) => {
        const doc1 = await seedBlankDocument(userA, teamA.id);
        const doc2 = await seedBlankDocument(userA, teamA.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/get-many`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            ids: {
              type: 'envelopeId',
              ids: [doc1.id, doc2.id],
            },
          },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const { data } = await res.json();
        expect(data.length).toBe(2);
        expect(data.map((d: { id: string }) => d.id).sort()).toEqual([doc1.id, doc2.id].sort());
      });

      test('should only return authorized envelopes when mixing owned and unowned', async ({
        request,
      }) => {
        const docA = await seedBlankDocument(userA, teamA.id);
        const docB = await seedBlankDocument(userB, teamB.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/get-many`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            ids: {
              type: 'envelopeId',
              ids: [docA.id, docB.id],
            },
          },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const { data } = await res.json();
        expect(data.length).toBe(1);
        expect(data[0].id).toBe(docA.id);
      });

      test('should block unauthorized access with documentId type', async ({ request }) => {
        const doc1 = await seedBlankDocument(userA, teamA.id);
        const doc2 = await seedBlankDocument(userA, teamA.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/get-many`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            ids: {
              type: 'documentId',
              ids: [
                mapSecondaryIdToDocumentId(doc1.secondaryId),
                mapSecondaryIdToDocumentId(doc2.secondaryId),
              ],
            },
          },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const { data } = await res.json();
        expect(data).toEqual([]);
      });

      test('should allow authorized access with documentId type', async ({ request }) => {
        const doc1 = await seedBlankDocument(userA, teamA.id);
        const doc2 = await seedBlankDocument(userA, teamA.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/get-many`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            ids: {
              type: 'documentId',
              ids: [
                mapSecondaryIdToDocumentId(doc1.secondaryId),
                mapSecondaryIdToDocumentId(doc2.secondaryId),
              ],
            },
          },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const { data } = await res.json();
        expect(data.length).toBe(2);
      });

      test('should block unauthorized access with templateId type', async ({ request }) => {
        const template1 = await seedBlankTemplate(userA, teamA.id);
        const template2 = await seedBlankTemplate(userA, teamA.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/get-many`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            ids: {
              type: 'templateId',
              ids: [
                mapSecondaryIdToTemplateId(template1.secondaryId),
                mapSecondaryIdToTemplateId(template2.secondaryId),
              ],
            },
          },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const { data } = await res.json();
        expect(data).toEqual([]);
      });

      test('should allow authorized access with templateId type', async ({ request }) => {
        const template1 = await seedBlankTemplate(userA, teamA.id);
        const template2 = await seedBlankTemplate(userA, teamA.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/get-many`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            ids: {
              type: 'templateId',
              ids: [
                mapSecondaryIdToTemplateId(template1.secondaryId),
                mapSecondaryIdToTemplateId(template2.secondaryId),
              ],
            },
          },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const { data } = await res.json();
        expect(data.length).toBe(2);
      });

      test('should reject requests exceeding max ID limit', async ({ request }) => {
        const ids = Array.from({ length: 21 }, () => 'envelope_fake123');

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/get-many`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            ids: {
              type: 'envelopeId',
              ids,
            },
          },
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(400);
      });
    });

    test.describe('Envelope get-many tRPC endpoint (teamId manipulation)', () => {
      test('should block access when user manipulates x-team-id to another team', async ({
        page,
      }) => {
        // Create documents for userA in teamA
        const doc1 = await seedBlankDocument(userA, teamA.id);
        const doc2 = await seedBlankDocument(userA, teamA.id);

        // Sign in as userB
        await apiSignin({ page, email: userB.email });

        const res = await page
          .context()
          .request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.getMany`, {
            headers: {
              'x-team-id': String(teamA.id),
            },
            data: {
              json: {
                ids: {
                  type: 'envelopeId',
                  ids: [doc1.id, doc2.id],
                },
              },
            },
          });

        // Make tRPC request with manipulated x-team-id pointing to teamA (which userB doesn't belong to)
        expect(res.ok()).toBeFalsy();
        // Team not found
        expect(res.status()).toBe(404);
      });

      test('should allow access when user uses their own team id', async ({ page }) => {
        // Create documents for userA in teamA
        const doc1 = await seedBlankDocument(userA, teamA.id);
        const doc2 = await seedBlankDocument(userA, teamA.id);

        // Sign in as userA
        await apiSignin({ page, email: userA.email });

        const res = await page
          .context()
          .request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.getMany`, {
            headers: {
              'Content-Type': 'application/json',
              'x-team-id': String(teamA.id),
            },
            data: {
              json: {
                ids: {
                  type: 'envelopeId',
                  ids: [doc1.id, doc2.id],
                },
              },
            },
          });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const data = await res.json();

        const items = data.result.data.json.data;

        expect(items.length).toBe(2);
        expect(items.map((d: { id: string }) => d.id).sort()).toEqual([doc1.id, doc2.id].sort());
      });

      test('should block access when switching team id mid-request to access other team data', async ({
        page,
      }) => {
        // Create a document for userA in teamA
        const docA = await seedBlankDocument(userA, teamA.id);
        // Create a document for userB in teamB
        const docB = await seedBlankDocument(userB, teamB.id);

        // Sign in as userB
        await apiSignin({ page, email: userB.email });

        const res = await page
          .context()
          .request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.getMany`, {
            headers: {
              'x-team-id': String(teamA.id),
            },
            data: {
              json: {
                ids: {
                  type: 'envelopeId',
                  ids: [docA.id, docB.id],
                },
              },
            },
          });

        // UserB tries to access both documents by manipulating teamId to teamA
        // Should fail - userB is not a member of teamA
        expect(res.ok()).toBeFalsy();
        // Team not found
        expect(res.status()).toBe(404);
      });
    });

    test.describe('Envelope find endpoint', () => {
      test('should block unauthorized access to envelope find endpoint', async ({ request }) => {
        await seedBlankDocument(userA, teamA.id);

        const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/envelope`, {
          headers: { Authorization: `Bearer ${tokenB}` },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const data = (await res.json()) as TFindEnvelopesResponse;
        expect(data.data.every((doc) => doc.userId !== userA.id)).toBe(true);
      });

      test('should allow authorized access to envelope find endpoint', async ({ request }) => {
        await seedBlankDocument(userA, teamA.id);

        const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/envelope`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const data = (await res.json()) as TFindEnvelopesResponse;
        expect(data.data.length).toBeGreaterThan(0);
        expect(data.data.some((doc) => doc.userId === userA.id)).toBe(true);
      });

      test('should respect team document visibility for ADMIN role', async ({ request }) => {
        const adminMember = await seedTeamMember({
          teamId: teamA.id,
          role: TeamMemberRole.ADMIN,
        });

        const { token: adminToken } = await createApiToken({
          userId: adminMember.id,
          teamId: teamA.id,
          tokenName: 'adminMember',
          expiresIn: null,
        });

        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            visibility: DocumentVisibility.ADMIN,
            title: 'Admin Only Document',
          },
        });

        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            visibility: DocumentVisibility.MANAGER_AND_ABOVE,
            title: 'Manager and Above Document',
          },
        });

        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            visibility: DocumentVisibility.EVERYONE,
            title: 'Everyone Document',
          },
        });

        const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/envelope`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        expect(res.ok()).toBeTruthy();
        const data = (await res.json()) as TFindEnvelopesResponse;

        const titles = data.data.map((doc) => doc.title);
        expect(titles).toContain('Admin Only Document');
        expect(titles).toContain('Manager and Above Document');
        expect(titles).toContain('Everyone Document');
      });

      test('should respect team document visibility for MANAGER role', async ({ request }) => {
        const managerMember = await seedTeamMember({
          teamId: teamA.id,
          role: TeamMemberRole.MANAGER,
        });

        const { token: managerToken } = await createApiToken({
          userId: managerMember.id,
          teamId: teamA.id,
          tokenName: 'managerMember',
          expiresIn: null,
        });

        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            visibility: DocumentVisibility.ADMIN,
            title: 'Admin Only Document',
          },
        });

        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            visibility: DocumentVisibility.MANAGER_AND_ABOVE,
            title: 'Manager and Above Document',
          },
        });

        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            visibility: DocumentVisibility.EVERYONE,
            title: 'Everyone Document',
          },
        });

        const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/envelope`, {
          headers: { Authorization: `Bearer ${managerToken}` },
        });

        expect(res.ok()).toBeTruthy();
        const data = (await res.json()) as TFindEnvelopesResponse;

        const titles = data.data.map((doc) => doc.title);
        expect(titles).not.toContain('Admin Only Document');
        expect(titles).toContain('Manager and Above Document');
        expect(titles).toContain('Everyone Document');
      });

      test('should filter envelopes by folderId with authorization', async ({ request }) => {
        const folder = await prisma.folder.create({
          data: {
            userId: userA.id,
            teamId: teamA.id,
            name: 'Test Folder',
            type: FolderType.DOCUMENT,
          },
        });

        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            folderId: folder.id,
            title: 'Document in Folder',
          },
        });

        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            title: 'Document Not in Folder',
          },
        });

        const resWithFolder = await request.get(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope?folderId=${folder.id}`,
          {
            headers: { Authorization: `Bearer ${tokenA}` },
          },
        );

        expect(resWithFolder.ok()).toBeTruthy();
        const dataWithFolder = (await resWithFolder.json()) as TFindEnvelopesResponse;
        expect(dataWithFolder.data.every((doc) => doc.folderId === folder.id)).toBe(true);
        expect(dataWithFolder.data.some((doc) => doc.title === 'Document in Folder')).toBe(true);

        const resUnauthorized = await request.get(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope?folderId=${folder.id}`,
          {
            headers: { Authorization: `Bearer ${tokenB}` },
          },
        );

        expect(resUnauthorized.ok()).toBeTruthy();
        const dataUnauthorized = (await resUnauthorized.json()) as TFindEnvelopesResponse;
        expect(
          dataUnauthorized.data.every(
            (doc) => doc.folderId !== folder.id || doc.userId !== userA.id,
          ),
        ).toBe(true);
      });

      test('should filter envelopes by type with authorization', async ({ request }) => {
        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            type: EnvelopeType.DOCUMENT,
            title: 'UserA Document',
          },
        });

        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            type: EnvelopeType.TEMPLATE,
            title: 'UserA Template',
          },
        });

        await seedBlankDocument(userB, teamB.id, {
          createDocumentOptions: {
            type: EnvelopeType.DOCUMENT,
            title: 'UserB Document',
          },
        });

        const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/envelope?type=DOCUMENT`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        });

        expect(res.ok()).toBeTruthy();
        const data = (await res.json()) as TFindEnvelopesResponse;
        expect(data.data.every((doc) => doc.type === EnvelopeType.DOCUMENT)).toBe(true);
        expect(data.data.every((doc) => doc.userId === userA.id)).toBe(true);
        expect(data.data.some((doc) => doc.title === 'UserA Document')).toBe(true);
        expect(data.data.every((doc) => doc.title !== 'UserB Document')).toBe(true);
      });

      test('should filter envelopes by status with authorization', async ({ request }) => {
        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            title: 'Draft Document',
            status: DocumentStatus.DRAFT,
          },
        });

        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            title: 'Completed Document',
            status: DocumentStatus.COMPLETED,
          },
        });

        await seedBlankDocument(userB, teamB.id, {
          createDocumentOptions: {
            title: 'UserB Draft',
            status: DocumentStatus.DRAFT,
          },
        });

        const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/envelope?status=DRAFT`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        });

        expect(res.ok()).toBeTruthy();
        const data = (await res.json()) as TFindEnvelopesResponse;
        expect(data.data.every((doc) => doc.status === DocumentStatus.DRAFT)).toBe(true);
        expect(data.data.every((doc) => doc.userId === userA.id)).toBe(true);
        expect(data.data.some((doc) => doc.title === 'Draft Document')).toBe(true);
        expect(data.data.every((doc) => doc.title !== 'UserB Draft')).toBe(true);
        expect(data.data.every((doc) => doc.title !== 'Completed Document')).toBe(true);
      });

      test('should search envelopes by query with authorization', async ({ request }) => {
        await seedBlankDocument(userA, teamA.id, {
          createDocumentOptions: {
            title: 'Unique Searchable Title UserA',
          },
        });

        await seedBlankDocument(userB, teamB.id, {
          createDocumentOptions: {
            title: 'Unique Searchable Title UserB',
          },
        });

        const res = await request.get(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope?query=Unique%20Searchable`,
          {
            headers: { Authorization: `Bearer ${tokenA}` },
          },
        );

        expect(res.ok()).toBeTruthy();
        const data = (await res.json()) as TFindEnvelopesResponse;
        expect(data.data.every((doc) => doc.userId === userA.id)).toBe(true);
        expect(data.data.some((doc) => doc.title.includes('UserA'))).toBe(true);
        expect(data.data.every((doc) => !doc.title.includes('UserB'))).toBe(true);
      });
    });

    test.describe('Envelope update endpoint', () => {
      test('should block unauthorized access to envelope update endpoint', async ({ request }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/update`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            envelopeId: doc.id,
            envelopeType: EnvelopeType.DOCUMENT,
            data: { title: 'Updated Title' },
          },
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope update endpoint', async ({ request }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/update`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            envelopeId: doc.id,
            envelopeType: EnvelopeType.DOCUMENT,
            data: { title: 'Updated Title' },
          },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope delete endpoint', () => {
      test('should block unauthorized access to envelope delete endpoint', async ({ request }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/delete`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: { envelopeId: doc.id },
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(401);
      });

      test('should allow authorized access to envelope delete endpoint', async ({ request }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/delete`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: { envelopeId: doc.id },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope duplicate endpoint', () => {
      test('should block unauthorized access to envelope duplicate endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/duplicate`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: { envelopeId: doc.id },
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope duplicate endpoint', async ({ request }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/duplicate`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: { envelopeId: doc.id },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope use endpoint', () => {
      test('should block unauthorized access to envelope use endpoint', async ({ request }) => {
        const doc = await seedTemplate({
          title: 'Team template 1',
          userId: userA.id,
          teamId: teamA.id,
          internalVersion: 2,
        });

        const payload: TUseEnvelopePayload = {
          envelopeId: doc.id,
        };

        const formData = new FormData();
        formData.append('payload', JSON.stringify(payload));

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/use`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          multipart: formData,
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope use endpoint', async ({ request }) => {
        const doc = await seedTemplate({
          title: 'Team template 1',
          userId: userA.id,
          teamId: teamA.id,
          internalVersion: 2,
        });

        const payload: TUseEnvelopePayload = {
          envelopeId: doc.id,
          distributeDocument: true,
          recipients: [
            {
              id: doc.recipients[0].id,
              email: doc.recipients[0].email,
              name: 'New Name',
            },
          ],
        };

        const formData = new FormData();
        formData.append('payload', JSON.stringify(payload));

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/use`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          multipart: formData,
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const data: TUseEnvelopeResponse = await res.json();

        const createdEnvelope = await prisma.envelope.findFirst({
          where: {
            id: data.id,
          },
          include: {
            recipients: true,
          },
        });

        expect(createdEnvelope).toBeDefined();
        expect(createdEnvelope?.recipients.length).toBe(1);
        expect(createdEnvelope?.recipients[0].email).toBe(doc.recipients[0].email);
        expect(createdEnvelope?.recipients[0].name).toBe('New Name');
        expect(createdEnvelope?.recipients[0].token).toBe(data.recipients[0].token);
        expect(createdEnvelope?.recipients[0].token).not.toBe(doc.recipients[0].token);
      });
    });

    test.describe('Envelope distribute endpoint', () => {
      test('should block unauthorized access to envelope distribute endpoint', async ({
        request,
      }) => {
        const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/distribute`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: { envelopeId: doc.id },
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(500);
      });

      test('should allow authorized access to envelope distribute endpoint', async ({
        request,
      }) => {
        const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/distribute`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: { envelopeId: doc.id },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope redistribute endpoint', () => {
      test('should block unauthorized access to envelope redistribute endpoint', async ({
        request,
      }) => {
        const doc = await seedPendingDocument(userA, teamA.id, []);

        const userRecipient = await prisma.recipient.create({
          data: {
            email: 'test@example.com',
            name: 'Test',
            token: nanoid(),
            readStatus: ReadStatus.NOT_OPENED,
            sendStatus: SendStatus.SENT,
            signingStatus: SigningStatus.NOT_SIGNED,
            signedAt: null,
            envelopeId: doc.id,
            fields: {
              create: {
                page: 1,
                type: FieldType.NAME,
                inserted: true,
                customText: '',
                positionX: new Prisma.Decimal(1),
                positionY: new Prisma.Decimal(1),
                width: new Prisma.Decimal(1),
                height: new Prisma.Decimal(1),
                envelopeId: doc.id,
                envelopeItemId: doc.envelopeItems[0].id,
              },
            },
          },
        });

        const recipient = await prisma.recipient.findFirst({
          where: {
            envelopeId: doc.id,
            email: userRecipient.email,
          },
        });

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/redistribute`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            envelopeId: doc.id,
            recipients: [recipient!.id],
          },
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(500);
      });

      test('should allow authorized access to envelope redistribute endpoint', async ({
        request,
      }) => {
        const doc = await seedPendingDocument(userA, teamA.id, []);

        const userRecipient = await prisma.recipient.create({
          data: {
            email: 'test@example.com',
            name: 'Test',
            token: nanoid(),
            readStatus: ReadStatus.NOT_OPENED,
            sendStatus: SendStatus.SENT,
            signingStatus: SigningStatus.NOT_SIGNED,
            signedAt: null,
            envelopeId: doc.id,
            fields: {
              create: {
                page: 1,
                type: FieldType.NAME,
                inserted: true,
                customText: '',
                positionX: new Prisma.Decimal(1),
                positionY: new Prisma.Decimal(1),
                width: new Prisma.Decimal(1),
                height: new Prisma.Decimal(1),
                envelopeId: doc.id,
                envelopeItemId: doc.envelopeItems[0].id,
              },
            },
          },
        });

        const recipient = await prisma.recipient.findFirst({
          where: {
            envelopeId: doc.id,
            email: userRecipient.email,
          },
        });

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/redistribute`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            envelopeId: doc.id,
            recipients: [recipient!.id],
          },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope field get endpoint', () => {
      test('should block unauthorized access to envelope field get endpoint', async ({
        request,
      }) => {
        const { user: userRecipient } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

        const recipient = await prisma.recipient.findFirst({
          where: {
            envelopeId: doc.id,
            email: userRecipient.email,
          },
        });

        const field = await prisma.field.create({
          data: {
            envelopeId: doc.id,
            envelopeItemId: doc.envelopeItems[0].id,
            recipientId: recipient!.id,
            type: 'TEXT',
            page: 1,
            positionX: 1,
            positionY: 1,
            width: 1,
            height: 1,
            customText: '',
            inserted: false,
            fieldMeta: { type: 'text', label: 'Test' },
          },
        });

        const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/field/${field.id}`, {
          headers: { Authorization: `Bearer ${tokenB}` },
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope field get endpoint', async ({ request }) => {
        const { user: userRecipient } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

        const recipient = await prisma.recipient.findFirstOrThrow({
          where: {
            envelopeId: doc.id,
            email: userRecipient.email,
          },
        });

        const field = await prisma.field.create({
          data: {
            envelopeId: doc.id,
            envelopeItemId: doc.envelopeItems[0].id,
            recipientId: recipient.id,
            type: 'TEXT',
            page: 1,
            positionX: 1,
            positionY: 1,
            width: 1,
            height: 1,
            customText: '',
            inserted: false,
            fieldMeta: { type: 'text', label: 'Test' },
          },
        });

        const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/field/${field.id}`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope field create-many endpoint', () => {
      test('should block unauthorized access to envelope field create-many endpoint', async ({
        request,
      }) => {
        const { user: userRecipient } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

        const recipient = await prisma.recipient.findFirst({
          where: { envelopeId: doc.id },
        });

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/field/create-many`,
          {
            headers: { Authorization: `Bearer ${tokenB}` },
            data: {
              envelopeId: doc.id,
              data: [
                {
                  recipientId: recipient!.id,
                  envelopeItemId: doc.envelopeItems[0].id,
                  type: 'TEXT',
                  page: 791.77,
                  positionX: 0,
                  positionY: 0,
                  width: 5,
                  height: 5,
                  fieldMeta: { type: 'text', label: 'First test field' },
                },
                {
                  recipientId: recipient!.id,
                  envelopeItemId: doc.envelopeItems[0].id,
                  type: 'TEXT',
                  page: 791.77,
                  positionX: 0,
                  positionY: 0,
                  width: 5,
                  height: 5,
                  fieldMeta: { type: 'text', label: 'Second test field' },
                },
              ],
            },
          },
        );

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope field create-many endpoint', async ({
        request,
      }) => {
        const { user: userRecipient } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

        const recipient = await prisma.recipient.findFirst({
          where: { envelopeId: doc.id },
        });

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/field/create-many`,
          {
            headers: { Authorization: `Bearer ${tokenA}` },
            data: {
              envelopeId: doc.id,
              data: [
                {
                  recipientId: recipient!.id,
                  envelopeItemId: doc.envelopeItems[0].id,
                  type: 'TEXT',
                  page: 791.77,
                  positionX: 0,
                  positionY: 0,
                  width: 5,
                  height: 5,
                  fieldMeta: { type: 'text', label: 'First test field' },
                },
                {
                  recipientId: recipient!.id,
                  envelopeItemId: doc.envelopeItems[0].id,
                  type: 'TEXT',
                  page: 791.77,
                  positionX: 0,
                  positionY: 0,
                  width: 5,
                  height: 5,
                  fieldMeta: { type: 'text', label: 'Second test field' },
                },
              ],
            },
          },
        );

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope field update-many endpoint', () => {
      test('should block unauthorized access to envelope field update-many endpoint', async ({
        request,
      }) => {
        const { user: userRecipient } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

        const recipient = await prisma.recipient.findFirst({
          where: { envelopeId: doc.id },
        });

        const fields = await prisma.field.createManyAndReturn({
          data: [
            {
              envelopeId: doc.id,
              envelopeItemId: doc.envelopeItems[0].id,
              recipientId: recipient!.id,
              type: FieldType.TEXT,
              page: 1,
              positionX: 1,
              positionY: 1,
              width: 1,
              height: 1,
              customText: '',
              inserted: false,
              fieldMeta: { type: 'text', label: 'Test' },
            },
            {
              envelopeId: doc.id,
              envelopeItemId: doc.envelopeItems[0].id,
              recipientId: recipient!.id,
              type: FieldType.NUMBER,
              page: 1,
              positionX: 1,
              positionY: 1,
              width: 1,
              height: 1,
              customText: '',
              inserted: false,
              fieldMeta: { type: 'text', label: 'Test' },
            },
          ],
        });

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/field/update-many`,
          {
            headers: { Authorization: `Bearer ${tokenB}` },
            data: {
              envelopeId: doc.id,
              data: [
                {
                  id: fields[0].id,
                  type: FieldType.TEXT,
                  fieldMeta: { type: 'text', label: 'Updated first test field' },
                },
                {
                  id: fields[1].id,
                  type: FieldType.NUMBER,
                  fieldMeta: { type: 'number', label: 'Updated second test field' },
                },
              ],
            },
          },
        );

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope field update-many endpoint', async ({
        request,
      }) => {
        const { user: userRecipient } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

        const recipient = await prisma.recipient.findFirst({
          where: { envelopeId: doc.id },
        });

        const fields = await prisma.field.createManyAndReturn({
          data: [
            {
              envelopeId: doc.id,
              envelopeItemId: doc.envelopeItems[0].id,
              recipientId: recipient!.id,
              type: FieldType.TEXT,
              page: 1,
              positionX: 1,
              positionY: 1,
              width: 1,
              height: 1,
              customText: '',
              inserted: false,
              fieldMeta: { type: 'text', label: 'Test' },
            },
            {
              envelopeId: doc.id,
              envelopeItemId: doc.envelopeItems[0].id,
              recipientId: recipient!.id,
              type: FieldType.NUMBER,
              page: 1,
              positionX: 1,
              positionY: 1,
              width: 1,
              height: 1,
              customText: '',
              inserted: false,
              fieldMeta: { type: 'text', label: 'Test' },
            },
          ],
        });

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/field/update-many`,
          {
            headers: { Authorization: `Bearer ${tokenA}` },
            data: {
              envelopeId: doc.id,
              data: [
                {
                  id: fields[0].id,
                  type: FieldType.TEXT,
                  fieldMeta: { type: 'text', label: 'Updated first test field' },
                },
                {
                  id: fields[1].id,
                  type: FieldType.NUMBER,
                  fieldMeta: { type: 'number', label: 'Updated second test field' },
                },
              ],
            },
          },
        );

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope field delete endpoint', () => {
      test('should block unauthorized access to envelope field delete endpoint', async ({
        request,
      }) => {
        const { user: userRecipient } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

        const recipient = await prisma.recipient.findFirst({
          where: { envelopeId: doc.id },
        });

        const field = await prisma.field.create({
          data: {
            envelopeId: doc.id,
            envelopeItemId: doc.envelopeItems[0].id,
            recipientId: recipient!.id,
            type: FieldType.TEXT,
            page: 1,
            positionX: 1,
            positionY: 1,
            width: 1,
            height: 1,
            customText: '',
            inserted: false,
            fieldMeta: { type: 'text', label: 'Test' },
          },
        });

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/field/delete`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: { fieldId: field.id },
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope field delete endpoint', async ({
        request,
      }) => {
        const { user: userRecipient } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

        const recipient = await prisma.recipient.findFirst({
          where: { envelopeId: doc.id },
        });

        const field = await prisma.field.create({
          data: {
            envelopeId: doc.id,
            envelopeItemId: doc.envelopeItems[0].id,
            recipientId: recipient!.id,
            type: FieldType.TEXT,
            page: 1,
            positionX: 1,
            positionY: 1,
            width: 1,
            height: 1,
            customText: '',
            inserted: false,
            fieldMeta: { type: 'text', label: 'Test' },
          },
        });

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/field/delete`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: { fieldId: field.id },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope recipient get endpoint', () => {
      test('should block unauthorized access to envelope recipient get endpoint', async ({
        request,
      }) => {
        const { user: recipientUser } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

        const recipient = await prisma.recipient.findFirst({
          where: { envelopeId: doc.id },
        });

        const res = await request.get(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/recipient/${recipient!.id}`,
          {
            headers: { Authorization: `Bearer ${tokenB}` },
          },
        );

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope recipient get endpoint', async ({
        request,
      }) => {
        const { user: recipientUser } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

        const recipient = await prisma.recipient.findFirst({
          where: { envelopeId: doc.id },
        });

        const res = await request.get(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/recipient/${recipient!.id}`,
          {
            headers: { Authorization: `Bearer ${tokenA}` },
          },
        );

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope recipient create-many endpoint', () => {
      test('should block unauthorized access to envelope recipient create-many endpoint', async ({
        request,
      }) => {
        const doc = await seedDraftDocument(userA, teamA.id, []);

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/recipient/create-many`,
          {
            headers: { Authorization: `Bearer ${tokenB}` },
            data: {
              envelopeId: doc.id,
              data: [
                {
                  name: 'Test',
                  email: 'test@example.com',
                  role: RecipientRole.SIGNER,
                },
                {
                  name: 'Test 2',
                  email: 'test2@example.com',
                  role: RecipientRole.SIGNER,
                },
              ],
            },
          },
        );

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope recipient create-many endpoint', async ({
        request,
      }) => {
        const doc = await seedDraftDocument(userA, teamA.id, []);

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/recipient/create-many`,
          {
            headers: { Authorization: `Bearer ${tokenA}` },
            data: {
              envelopeId: doc.id,
              data: [
                {
                  name: 'Test',
                  email: 'test@example.com',
                  role: RecipientRole.SIGNER,
                },
                {
                  name: 'Test 2',
                  email: 'test2@example.com',
                  role: RecipientRole.SIGNER,
                },
              ],
            },
          },
        );

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope recipient update-many endpoint', () => {
      test('should block unauthorized access to envelope recipient update-many endpoint', async ({
        request,
      }) => {
        const { user: firstRecipient } = await seedUser();
        const { user: secondRecipient } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [firstRecipient, secondRecipient]);

        const firstDocumentRecipient = await prisma.recipient.findFirst({
          where: {
            envelopeId: doc.id,
            email: firstRecipient.email,
          },
        });

        const secondDocumentRecipient = await prisma.recipient.findFirst({
          where: {
            envelopeId: doc.id,
            email: secondRecipient.email,
          },
        });

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/recipient/update-many`,
          {
            headers: { Authorization: `Bearer ${tokenB}` },
            data: {
              envelopeId: doc.id,
              data: [
                {
                  id: firstDocumentRecipient!.id,
                  name: 'Updated first recipient',
                },
                {
                  id: secondDocumentRecipient!.id,
                  name: 'Updated second recipient',
                },
              ],
            },
          },
        );

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope recipient update-many endpoint', async ({
        request,
      }) => {
        const { user: firstRecipient } = await seedUser();
        const { user: secondRecipient } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [firstRecipient, secondRecipient]);

        const firstDocumentRecipient = await prisma.recipient.findFirst({
          where: {
            envelopeId: doc.id,
            email: firstRecipient.email,
          },
        });

        const secondDocumentRecipient = await prisma.recipient.findFirst({
          where: {
            envelopeId: doc.id,
            email: secondRecipient.email,
          },
        });

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/recipient/update-many`,
          {
            headers: { Authorization: `Bearer ${tokenA}` },
            data: {
              envelopeId: doc.id,
              data: [
                {
                  id: firstDocumentRecipient!.id,
                  name: 'Updated first recipient',
                },
                {
                  id: secondDocumentRecipient!.id,
                  name: 'Updated second recipient',
                },
              ],
            },
          },
        );

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope recipient delete endpoint', () => {
      test('should block unauthorized access to envelope recipient delete endpoint', async ({
        request,
      }) => {
        const { user: recipientUser } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

        const recipient = await prisma.recipient.findFirst({
          where: { envelopeId: doc.id },
        });

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/recipient/delete`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: { recipientId: recipient!.id },
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope recipient delete endpoint', async ({
        request,
      }) => {
        const { user: recipientUser } = await seedUser();

        const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

        const recipient = await prisma.recipient.findFirst({
          where: { envelopeId: doc.id },
        });

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/recipient/delete`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: { recipientId: recipient!.id },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope item create-many endpoint', () => {
      test('should block unauthorized access to envelope item create-many endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const fieldMetaPdf = fs.readFileSync(
          path.join(__dirname, '../../../../../assets/field-meta.pdf'),
        );

        const createEnvelopeItemsPayload: TCreateEnvelopeItemsPayload = {
          envelopeId: doc.id,
        };

        const formData = new FormData();
        formData.append('payload', JSON.stringify(createEnvelopeItemsPayload));
        formData.append(
          'files',
          new File([fieldMetaPdf], 'field-meta.pdf', { type: 'application/pdf' }),
        );

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/item/create-many`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          multipart: formData,
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope item create-many endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const fieldMetaPdf = fs.readFileSync(
          path.join(__dirname, '../../../../../assets/field-meta.pdf'),
        );

        const createEnvelopeItemsPayload: TCreateEnvelopeItemsPayload = {
          envelopeId: doc.id,
        };

        const formData = new FormData();
        formData.append('payload', JSON.stringify(createEnvelopeItemsPayload));
        formData.append(
          'files',
          new File([fieldMetaPdf], 'field-meta-1.pdf', { type: 'application/pdf' }),
        );
        formData.append(
          'files',
          new File([fieldMetaPdf], 'field-meta-2.pdf', { type: 'application/pdf' }),
        );

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/item/create-many`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          multipart: formData,
        });

        const envelope = await prisma.envelope.findFirstOrThrow({
          where: {
            id: doc.id,
          },
          include: {
            envelopeItems: true,
          },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const envelopeItems = envelope.envelopeItems;

        // 3 Files because seed creates one automatically.
        expect(envelopeItems.length).toBe(3);

        const isFieldMeta1 = envelopeItems.find((item) => item.title === 'field-meta-1.pdf');
        const isFieldMeta2 = envelopeItems.find((item) => item.title === 'field-meta-2.pdf');

        expect(isFieldMeta1).toBeDefined();
        expect(isFieldMeta2).toBeDefined();
      });
    });

    test.describe('Envelope item update-many endpoint', () => {
      test('should block unauthorized access to envelope item update-many endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
          where: { envelopeId: doc.id },
        });

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/item/update-many`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            envelopeId: doc.id,
            data: [
              {
                envelopeItemId: envelopeItem.id,
                title: 'Updated Item Title',
              },
            ],
          },
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope item update-many endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
          where: { envelopeId: doc.id },
        });

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/item/update-many`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            envelopeId: doc.id,
            data: [
              {
                envelopeItemId: envelopeItem.id,
                title: 'Updated Item Title',
              },
            ],
          },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope item delete endpoint', () => {
      test('should block unauthorized access to envelope item delete endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
          where: { envelopeId: doc.id },
        });

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/item/delete`, {
          headers: { Authorization: `Bearer ${tokenB}` },
          data: {
            envelopeId: doc.id,
            envelopeItemId: envelopeItem.id,
          },
        });

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope item delete endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
          where: { envelopeId: doc.id },
        });

        const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/item/delete`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            envelopeId: doc.id,
            envelopeItemId: envelopeItem.id,
          },
        });

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope attachment find endpoint', () => {
      test('should block unauthorized access to envelope attachment find endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.get(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment?envelopeId=${doc.id}`,
          {
            headers: { Authorization: `Bearer ${tokenB}` },
          },
        );

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope attachment find endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.get(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment?envelopeId=${doc.id}`,
          {
            headers: { Authorization: `Bearer ${tokenA}` },
          },
        );

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope attachment create endpoint', () => {
      test('should block unauthorized access to envelope attachment create endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment/create`,
          {
            headers: { Authorization: `Bearer ${tokenB}` },
            data: {
              envelopeId: doc.id,
              data: {
                label: 'Test Attachment',
                data: 'https://example.com/file.pdf',
              },
            },
          },
        );

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope attachment create endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment/create`,
          {
            headers: { Authorization: `Bearer ${tokenA}` },
            data: {
              envelopeId: doc.id,
              data: {
                label: 'Test Attachment',
                data: 'https://example.com/file.pdf',
              },
            },
          },
        );

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope attachment update endpoint', () => {
      test('should block unauthorized access to envelope attachment update endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const attachment = await prisma.envelopeAttachment.create({
          data: {
            envelopeId: doc.id,
            type: 'link',
            label: 'Original Label',
            data: 'https://example.com/original.pdf',
          },
        });

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment/update`,
          {
            headers: { Authorization: `Bearer ${tokenB}` },
            data: {
              id: attachment.id,
              data: {
                label: 'Updated Label',
                data: 'https://example.com/updated.pdf',
              },
            },
          },
        );

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope attachment update endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const attachment = await prisma.envelopeAttachment.create({
          data: {
            envelopeId: doc.id,
            type: 'link',
            label: 'Original Label',
            data: 'https://example.com/original.pdf',
          },
        });

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment/update`,
          {
            headers: { Authorization: `Bearer ${tokenA}` },
            data: {
              id: attachment.id,
              data: {
                label: 'Updated Label',
                data: 'https://example.com/updated.pdf',
              },
            },
          },
        );

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope attachment delete endpoint', () => {
      test('should block unauthorized access to envelope attachment delete endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const attachment = await prisma.envelopeAttachment.create({
          data: {
            envelopeId: doc.id,
            type: 'link',
            label: 'Test Attachment',
            data: 'https://example.com/file.pdf',
          },
        });

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment/delete`,
          {
            headers: { Authorization: `Bearer ${tokenB}` },
            data: { id: attachment.id },
          },
        );

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope attachment delete endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const attachment = await prisma.envelopeAttachment.create({
          data: {
            envelopeId: doc.id,
            type: 'link',
            label: 'Test Attachment',
            data: 'https://example.com/file.pdf',
          },
        });

        const res = await request.post(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment/delete`,
          {
            headers: { Authorization: `Bearer ${tokenA}` },
            data: { id: attachment.id },
          },
        );

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Envelope audit logs endpoint', () => {
      test('should block unauthorized access to envelope audit logs endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        const res = await request.get(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/${doc.id}/audit-log`,
          {
            headers: { Authorization: `Bearer ${tokenB}` },
          },
        );

        expect(res.ok()).toBeFalsy();
        expect(res.status()).toBe(404);
      });

      test('should allow authorized access to envelope audit logs endpoint', async ({
        request,
      }) => {
        const doc = await seedBlankDocument(userA, teamA.id);

        // Add a recipient which will trigger an audit log.
        await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/recipient/create-many`, {
          headers: { Authorization: `Bearer ${tokenA}` },
          data: {
            envelopeId: doc.id,
            data: [
              {
                name: 'Test',
                email: 'test@example.com',
                role: RecipientRole.SIGNER,
              },
            ],
          },
        });

        const res = await request.get(
          `${WEBAPP_BASE_URL}/api/v2-beta/envelope/${doc.id}/audit-log`,
          {
            headers: { Authorization: `Bearer ${tokenA}` },
          },
        );

        expect(res.ok()).toBeTruthy();
        expect(res.status()).toBe(200);

        const data = await res.json();

        expect(Array.isArray(data.data)).toBe(true);
        expect(data.count).toEqual(1);
        expect(data.data[0].type).toEqual('RECIPIENT_CREATED');
        expect(data.currentPage).toBeGreaterThanOrEqual(1);
        expect(data.perPage).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
