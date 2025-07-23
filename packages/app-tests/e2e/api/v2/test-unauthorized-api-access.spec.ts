import { expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import {
  DocumentVisibility,
  FieldType,
  Prisma,
  ReadStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '@documenso/prisma/client';
import {
  seedBlankDocument,
  seedCompletedDocument,
  seedDraftDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

test.describe('Unauthorized Access - Document API V2', () => {
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

  test('should block unauthorized access to document detail endpoint', async ({ request }) => {
    const doc = await seedBlankDocument(userA, teamA.id);

    const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/document/${doc.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to document update endpoint', async ({ request }) => {
    const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/update`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { documentId: doc.id, data: { title: 'Updated Title' } },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to document delete endpoint', async ({ request }) => {
    const doc = await seedDraftDocument(userA, teamA.id, []);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/delete`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { documentId: doc.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });

  test('should block unauthorized access to document move endpoint', async ({ request }) => {
    const doc = await seedDraftDocument(userA, teamA.id, []);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/move`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { documentId: doc.id, teamId: teamB.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to document distribute endpoint', async ({ request }) => {
    const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/distribute`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { documentId: doc.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(500);
  });

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
        document: {
          connect: {
            id: doc.id,
          },
        },
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
            documentId: doc.id,
          },
        },
      },
    });

    const recipient = await prisma.recipient.findFirst({
      where: {
        documentId: doc.id,
        email: userRecipient.email,
      },
    });

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/redistribute`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { documentId: doc.id, recipients: [recipient!.id] },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(500);
  });

  test('should block unauthorized access to document duplicate endpoint', async ({ request }) => {
    const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/duplicate`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { documentId: doc.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to document field endpoint', async ({ request }) => {
    const { user: userRecipient } = await seedUser();

    const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

    const recipient = await prisma.recipient.findFirst({
      where: {
        documentId: doc.id,
        email: userRecipient.email,
      },
    });

    const field = await prisma.field.create({
      data: {
        documentId: doc.id,
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

  test('should block unauthorized access to document field create endpoint', async ({
    request,
  }) => {
    const { user: userRecipient } = await seedUser();

    const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

    const recipient = await prisma.recipient.findFirst({
      where: { documentId: doc.id },
    });

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/create`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: {
        documentId: doc.id,
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

  test('should block unauthorized access to document field create-many endpoint', async ({
    request,
  }) => {
    const { user: userRecipient } = await seedUser();

    const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

    const recipient = await prisma.recipient.findFirst({
      where: { documentId: doc.id },
    });

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/field/create-many`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: {
        documentId: doc.id,
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

  test('should block unauthorized access to document field update endpoint', async ({
    request,
  }) => {
    const { user: userRecipient } = await seedUser();

    const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

    const recipient = await prisma.recipient.findFirst({
      where: { documentId: doc.id },
    });

    const field = await prisma.field.create({
      data: {
        documentId: doc.id,
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
        documentId: doc.id,
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

  test('should block unauthorized access to document field update-many endpoint', async ({
    request,
  }) => {
    const { user: userRecipient } = await seedUser();

    const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

    const recipient = await prisma.recipient.findFirst({
      where: { documentId: doc.id },
    });

    const fields = await prisma.field.createManyAndReturn({
      data: [
        {
          documentId: doc.id,
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
          documentId: doc.id,
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
        documentId: doc.id,
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

  test('should block unauthorized access to document field delete endpoint', async ({
    request,
  }) => {
    const { user: userRecipient } = await seedUser();

    const doc = await seedDraftDocument(userA, teamA.id, [userRecipient.email]);

    const recipient = await prisma.recipient.findFirst({
      where: { documentId: doc.id },
    });

    const field = await prisma.field.create({
      data: {
        documentId: doc.id,
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

  test('should block unauthorized access to template field create endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
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
        templateId: template.id,
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

  test('should block unauthorized access to template field get field endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
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
        templateId: template.id,
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

  test('should block unauthorized access to template field create-many endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
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
        templateId: template.id,
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
        templateId: template.id,
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

  test('should block unauthorized access to template field update endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
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
        templateId: template.id,
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
        templateId: template.id,
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

  test('should block unauthorized access to template field update-many endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
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
          templateId: template.id,
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
          templateId: template.id,
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
        templateId: template.id,
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

  test('should block unauthorized access to template field delete endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
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
        templateId: template.id,
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

  test('should block unauthorized access to document recipient get endpoint', async ({
    request,
  }) => {
    const { user: recipientUser } = await seedUser();

    const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

    const recipient = await prisma.recipient.findFirst({
      where: { documentId: doc.id },
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

  test('should block unauthorized access to document recipient create endpoint', async ({
    request,
  }) => {
    const doc = await seedDraftDocument(userA, teamA.id, []);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/create`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: {
        documentId: doc.id,
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

  test('should block unauthorized access to document recipient create-many endpoint', async ({
    request,
  }) => {
    const doc = await seedDraftDocument(userA, teamA.id, []);

    const res = await request.post(
      `${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/create-many`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          documentId: doc.id,
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

  test('should block unauthorized access to document recipient update endpoint', async ({
    request,
  }) => {
    const { user: recipientUser } = await seedUser();

    const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

    const recipient = await prisma.recipient.findFirst({
      where: { documentId: doc.id },
    });

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/update`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: {
        documentId: doc.id,
        recipient: {
          id: recipient!.id,
          name: 'Updated recipient',
        },
      },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to document recipient update-many endpoint', async ({
    request,
  }) => {
    const { user: firstRecipient } = await seedUser();
    const { user: secondRecipient } = await seedUser();

    const doc = await seedDraftDocument(userA, teamA.id, [firstRecipient, secondRecipient]);

    const firstDocumentRecipient = await prisma.recipient.findFirst({
      where: { documentId: doc.id, email: firstRecipient.email },
    });

    const secondDocumentRecipient = await prisma.recipient.findFirst({
      where: { documentId: doc.id, email: secondRecipient.email },
    });

    const res = await request.post(
      `${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/update-many`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          documentId: doc.id,
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

  test('should block unauthorized access to document recipient delete endpoint', async ({
    request,
  }) => {
    const { user: recipientUser } = await seedUser();

    const doc = await seedDraftDocument(userA, teamA.id, [recipientUser]);

    const recipient = await prisma.recipient.findFirst({
      where: { documentId: doc.id },
    });

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/recipient/delete`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { recipientId: recipient!.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to template recipient get endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const templateRecipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
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

  test('should block unauthorized access to template recipient create endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/create`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: {
        templateId: template.id,
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

  test('should block unauthorized access to template recipient create-many endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const res = await request.post(
      `${WEBAPP_BASE_URL}/api/v2-beta/template/recipient/create-many`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          templateId: template.id,
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

  test('should block unauthorized access to template recipient update endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
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
        templateId: template.id,
        recipient: {
          id: recipient.id,
          name: 'Updated test name',
        },
      },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to template recipient update-many endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const recipients = await prisma.recipient.createManyAndReturn({
      data: [
        {
          templateId: template.id,
          email: 'test@example.com',
          name: 'Test',
          token: nanoid(12),
          readStatus: ReadStatus.NOT_OPENED,
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
        {
          templateId: template.id,
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
          templateId: template.id,
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

  test('should block unauthorized access to template recipient delete endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
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

  test('should block unauthorized access to template get endpoint', async ({ request }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/template/${template.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to template update endpoint', async ({ request }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/update`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: {
        templateId: template.id,
        data: {
          title: 'Updated template title',
          visibility: DocumentVisibility.MANAGER_AND_ABOVE,
        },
      },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to template duplicate endpoint', async ({ request }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/duplicate`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { templateId: template.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(500);
  });

  test('should block unauthorized access to template delete endpoint', async ({ request }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/delete`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { templateId: template.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(500);
  });

  test('should block unauthorized access to template use endpoint', async ({ request }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const { user: firstRecipientUser } = await seedUser();
    const { user: secondRecipientUser } = await seedUser();

    await prisma.template.update({
      where: { id: template.id },
      data: {
        recipients: {
          create: [
            {
              id: firstRecipientUser.id,
              name: firstRecipientUser.name || '',
              email: firstRecipientUser.email,
              token: nanoid(12),
              readStatus: ReadStatus.NOT_OPENED,
              sendStatus: SendStatus.NOT_SENT,
              signingStatus: SigningStatus.NOT_SIGNED,
            },
            {
              id: secondRecipientUser.id,
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
    });

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/use`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: {
        templateId: template.id,
        recipients: [
          {
            id: firstRecipientUser.id,
            name: firstRecipientUser.name,
            email: firstRecipientUser.email,
            role: RecipientRole.SIGNER,
          },
          {
            id: secondRecipientUser.id,
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

  test('should block unauthorized access to template direct create endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/direct/create`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { templateId: template.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to template direct delete endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
        name: 'Test',
        email: 'test@example.com',
        token: nanoid(12),
      },
    });

    await prisma.templateDirectLink.create({
      data: {
        templateId: template.id,
        enabled: true,
        token: nanoid(12),
        directTemplateRecipientId: recipient.id,
      },
    });

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/direct/delete`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { templateId: template.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to template direct toggle endpoint', async ({
    request,
  }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
        name: 'Test',
        email: 'test@example.com',
        token: nanoid(12),
      },
    });

    await prisma.templateDirectLink.create({
      data: {
        templateId: template.id,
        enabled: true,
        token: nanoid(12),
        directTemplateRecipientId: recipient.id,
      },
    });

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/direct/toggle`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { templateId: template.id, enabled: false },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to template move endpoint', async ({ request }) => {
    const template = await seedBlankTemplate(userA, teamA.id);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/move`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { templateId: template.id, teamId: teamB.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });
});
