import { expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { pick } from 'remeda';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import {
  DocumentDistributionMethod,
  DocumentSigningOrder,
  DocumentStatus,
  DocumentVisibility,
  EnvelopeType,
  FieldType,
  FolderType,
  RecipientRole,
} from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TCreateEnvelopeItemsPayload } from '@documenso/trpc/server/envelope-router/create-envelope-items.types';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import type { TCreateEnvelopeRecipientsRequest } from '@documenso/trpc/server/envelope-router/envelope-recipients/create-envelope-recipients.types';
import type { TGetEnvelopeResponse } from '@documenso/trpc/server/envelope-router/get-envelope.types';
import type { TUpdateEnvelopeRequest } from '@documenso/trpc/server/envelope-router/update-envelope.types';

import { ALIGNMENT_TEST_FIELDS } from '../../../constants/field-alignment-pdf';
import { FIELD_META_TEST_FIELDS } from '../../../constants/field-meta-pdf';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

test.describe('API V2 Envelopes', () => {
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

  test.describe('Envelope create endpoint', () => {
    test('should fail on invalid form', async ({ request }) => {
      const payload = {
        type: 'Invalid Type',
        title: 'Test Envelope',
      };

      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));

      const res = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        multipart: formData,
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(400);
    });

    test('should create envelope with single file', async ({ request }) => {
      const payload = {
        type: EnvelopeType.TEMPLATE,
        title: 'Test Envelope',
      } satisfies TCreateEnvelopePayload;

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));

      const files = [
        {
          name: 'field-font-alignment.pdf',
          data: fs.readFileSync(
            path.join(__dirname, '../../../../../assets/field-font-alignment.pdf'),
          ),
        },
      ];

      for (const file of files) {
        formData.append('files', new File([file.data], file.name, { type: 'application/pdf' }));
      }

      const res = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        multipart: formData,
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const response = (await res.json()) as TCreateEnvelopeResponse;

      const envelope = await prisma.envelope.findUnique({
        where: {
          id: response.id,
        },
        include: {
          envelopeItems: true,
        },
      });

      expect(envelope).toBeDefined();
      expect(envelope?.title).toBe('Test Envelope');
      expect(envelope?.type).toBe(EnvelopeType.TEMPLATE);
      expect(envelope?.status).toBe(DocumentStatus.DRAFT);
      expect(envelope?.envelopeItems.length).toBe(1);
      expect(envelope?.envelopeItems[0].title).toBe('field-font-alignment.pdf');
      expect(envelope?.envelopeItems[0].documentDataId).toBeDefined();
    });

    test('should create envelope with multiple file', async ({ request }) => {
      const folder = await prisma.folder.create({
        data: {
          name: 'Test Folder',
          teamId: teamA.id,
          userId: userA.id,
          type: FolderType.DOCUMENT,
        },
      });

      const payload = {
        title: 'Envelope Title',
        type: EnvelopeType.DOCUMENT,
        externalId: 'externalId',
        visibility: DocumentVisibility.MANAGER_AND_ABOVE,
        globalAccessAuth: ['ACCOUNT'],
        formValues: {
          hello: 'world',
        },
        folderId: folder.id,
        recipients: [
          {
            email: userA.email,
            name: 'Name',
            role: RecipientRole.SIGNER,
            accessAuth: ['TWO_FACTOR_AUTH'],
            signingOrder: 1,
            fields: [
              {
                type: FieldType.SIGNATURE,
                identifier: 'field-font-alignment.pdf',
                page: 1,
                positionX: 0,
                positionY: 0,
                width: 0,
                height: 0,
              },
              {
                type: FieldType.SIGNATURE,
                identifier: 0,
                page: 1,
                positionX: 0,
                positionY: 0,
                width: 0,
                height: 0,
              },
            ],
          },
        ],
        meta: {
          subject: 'Subject',
          message: 'Message',
          timezone: 'Europe/Berlin',
          dateFormat: 'dd.MM.yyyy',
          distributionMethod: DocumentDistributionMethod.NONE,
          signingOrder: DocumentSigningOrder.SEQUENTIAL,
          allowDictateNextSigner: true,
          redirectUrl: 'https://documenso.com',
          language: 'de',
          typedSignatureEnabled: true,
          uploadSignatureEnabled: false,
          drawSignatureEnabled: false,
          emailReplyTo: userA.email,
          emailSettings: {
            recipientSigningRequest: false,
            recipientRemoved: false,
            recipientSigned: false,
            documentPending: false,
            documentCompleted: false,
            documentDeleted: false,
            ownerDocumentCompleted: true,
          },
        },
        attachments: [
          {
            label: 'Test Attachment',
            data: 'https://documenso.com',
            type: 'link',
          },
        ],
      } satisfies TCreateEnvelopePayload;

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));

      const files = [
        {
          name: 'field-meta.pdf',
          data: fs.readFileSync(path.join(__dirname, '../../../../../assets/field-meta.pdf')),
        },
        {
          name: 'field-font-alignment.pdf',
          data: fs.readFileSync(
            path.join(__dirname, '../../../../../assets/field-font-alignment.pdf'),
          ),
        },
      ];

      for (const file of files) {
        formData.append('files', new File([file.data], file.name, { type: 'application/pdf' }));
      }

      // Should error since folder is not owned by the user.
      const invalidRes = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        multipart: formData,
      });

      expect(invalidRes.ok()).toBeFalsy();

      const res = await request.post(`${baseUrl}/envelope/create`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        multipart: formData,
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const response = (await res.json()) as TCreateEnvelopeResponse;

      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: {
          id: response.id,
        },
        include: {
          documentMeta: true,
          envelopeItems: true,
          recipients: true,
          fields: true,
          envelopeAttachments: true,
        },
      });

      console.log(userB.email);

      expect(envelope.envelopeItems.length).toBe(2);
      expect(envelope.envelopeItems[0].title).toBe('field-meta.pdf');
      expect(envelope.envelopeItems[1].title).toBe('field-font-alignment.pdf');

      expect(envelope.title).toBe(payload.title);
      expect(envelope.type).toBe(payload.type);
      expect(envelope.externalId).toBe(payload.externalId);
      expect(envelope.visibility).toBe(payload.visibility);
      expect(envelope.authOptions).toEqual({
        globalAccessAuth: payload.globalAccessAuth,
        globalActionAuth: [],
      });
      expect(envelope.formValues).toEqual(payload.formValues);
      expect(envelope.folderId).toBe(payload.folderId);

      expect(envelope.documentMeta.subject).toBe(payload.meta.subject);
      expect(envelope.documentMeta.message).toBe(payload.meta.message);
      expect(envelope.documentMeta.timezone).toBe(payload.meta.timezone);
      expect(envelope.documentMeta.dateFormat).toBe(payload.meta.dateFormat);
      expect(envelope.documentMeta.distributionMethod).toBe(payload.meta.distributionMethod);
      expect(envelope.documentMeta.signingOrder).toBe(payload.meta.signingOrder);
      expect(envelope.documentMeta.allowDictateNextSigner).toBe(
        payload.meta.allowDictateNextSigner,
      );
      expect(envelope.documentMeta.redirectUrl).toBe(payload.meta.redirectUrl);
      expect(envelope.documentMeta.language).toBe(payload.meta.language);
      expect(envelope.documentMeta.typedSignatureEnabled).toBe(payload.meta.typedSignatureEnabled);
      expect(envelope.documentMeta.uploadSignatureEnabled).toBe(
        payload.meta.uploadSignatureEnabled,
      );
      expect(envelope.documentMeta.drawSignatureEnabled).toBe(payload.meta.drawSignatureEnabled);
      expect(envelope.documentMeta.emailReplyTo).toBe(payload.meta.emailReplyTo);
      expect(envelope.documentMeta.emailSettings).toEqual(payload.meta.emailSettings);

      expect([
        {
          label: envelope.envelopeAttachments[0].label,
          data: envelope.envelopeAttachments[0].data,
          type: envelope.envelopeAttachments[0].type,
        },
      ]).toEqual(payload.attachments);

      const field = envelope.fields[0];
      const recipient = envelope.recipients[0];

      expect({
        email: recipient.email,
        name: recipient.name,
        role: recipient.role,
        signingOrder: recipient.signingOrder,
        accessAuth: recipient.authOptions?.accessAuth,
      }).toEqual(
        pick(payload.recipients[0], ['email', 'name', 'role', 'signingOrder', 'accessAuth']),
      );

      expect({
        type: field.type,
        page: field.page,
        positionX: field.positionX.toNumber(),
        positionY: field.positionY.toNumber(),
        width: field.width.toNumber(),
        height: field.height.toNumber(),
      }).toEqual(
        pick(payload.recipients[0].fields[0], [
          'type',
          'page',
          'positionX',
          'positionY',
          'width',
          'height',
        ]),
      );

      // Expect string based ID to work.
      expect(field.envelopeItemId).toBe(
        envelope.envelopeItems.find((item) => item.title === 'field-font-alignment.pdf')?.id,
      );

      // Expect index based ID to work.
      expect(envelope.fields[1].envelopeItemId).toBe(
        envelope.envelopeItems.find((item) => item.title === 'field-meta.pdf')?.id,
      );
    });
  });

  /**
   * Creates envelopes with the two field test PDFs.
   */
  test('Envelope full test', async ({ request }) => {
    // Step 1: Create initial envelope with Prisma (with first envelope item)
    const alignmentPdf = fs.readFileSync(
      path.join(__dirname, '../../../../../assets/field-font-alignment.pdf'),
    );

    const fieldMetaPdf = fs.readFileSync(
      path.join(__dirname, '../../../../../assets/field-meta.pdf'),
    );

    const formData = new FormData();

    formData.append(
      'payload',
      JSON.stringify({
        type: EnvelopeType.DOCUMENT,
        title: 'Envelope Full Field Test',
      } satisfies TCreateEnvelopePayload),
    );

    // Only add one file for now.
    formData.append(
      'files',
      new File([alignmentPdf], 'field-font-alignment.pdf', { type: 'application/pdf' }),
    );

    const createEnvelopeRequest = await request.post(`${baseUrl}/envelope/create`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      multipart: formData,
    });

    expect(createEnvelopeRequest.ok()).toBeTruthy();
    expect(createEnvelopeRequest.status()).toBe(200);

    const { id: createdEnvelopeId }: TCreateEnvelopeResponse = await createEnvelopeRequest.json();

    const getEnvelopeRequest = await request.get(`${baseUrl}/envelope/${createdEnvelopeId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const createdEnvelope: TGetEnvelopeResponse = await getEnvelopeRequest.json();

    // Might as well testing access control here as well.
    const unauthRequest = await request.get(`${baseUrl}/envelope/${createdEnvelopeId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(unauthRequest.ok()).toBeFalsy();
    expect(unauthRequest.status()).toBe(404);

    // Step 2: Create second envelope item via API
    const createEnvelopeItemsPayload: TCreateEnvelopeItemsPayload = {
      envelopeId: createdEnvelope.id,
    };

    const createEnvelopeItemFormData = new FormData();
    createEnvelopeItemFormData.append('payload', JSON.stringify(createEnvelopeItemsPayload));
    createEnvelopeItemFormData.append(
      'files',
      new File([fieldMetaPdf], 'field-meta.pdf', { type: 'application/pdf' }),
    );

    const createItemsRes = await request.post(`${baseUrl}/envelope/item/create-many`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      multipart: createEnvelopeItemFormData,
    });

    expect(createItemsRes.ok()).toBeTruthy();
    expect(createItemsRes.status()).toBe(200);

    // Step 3: Update envelope via API
    const updateEnvelopeRequest: TUpdateEnvelopeRequest = {
      envelopeId: createdEnvelope.id,
      data: {
        title: 'Envelope Full Field Test',
        visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      },
    };

    const updateRes = await request.post(`${baseUrl}/envelope/update`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: updateEnvelopeRequest,
    });

    expect(updateRes.ok()).toBeTruthy();
    expect(updateRes.status()).toBe(200);

    // Step 4: Create recipient via API
    const createRecipientsRequest: TCreateEnvelopeRecipientsRequest = {
      envelopeId: createdEnvelope.id,
      data: [
        {
          email: userA.email,
          name: userA.name || '',
          role: RecipientRole.SIGNER,
          accessAuth: [],
          actionAuth: [],
        },
      ],
    };

    const createRecipientsRes = await request.post(`${baseUrl}/envelope/recipient/create-many`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: createRecipientsRequest,
    });

    expect(createRecipientsRes.ok()).toBeTruthy();
    expect(createRecipientsRes.status()).toBe(200);

    // Step 5: Get envelope to retrieve recipients and envelope items
    const getRes = await request.get(`${baseUrl}/envelope/${createdEnvelope.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(getRes.ok()).toBeTruthy();
    expect(getRes.status()).toBe(200);

    const envelopeResponse = (await getRes.json()) as TGetEnvelopeResponse;

    const recipientId = envelopeResponse.recipients[0].id;
    const alignmentItem = envelopeResponse.envelopeItems.find(
      (item: { order: number }) => item.order === 1,
    );
    const fieldMetaItem = envelopeResponse.envelopeItems.find(
      (item: { order: number }) => item.order === 2,
    );

    expect(recipientId).toBeDefined();
    expect(alignmentItem).toBeDefined();
    expect(fieldMetaItem).toBeDefined();

    if (!alignmentItem || !fieldMetaItem) {
      throw new Error('Envelope items not found');
    }

    // Step 6: Create fields for first PDF (alignment fields)
    const alignmentFieldsRequest = {
      envelopeId: createdEnvelope.id,
      data: ALIGNMENT_TEST_FIELDS.map((field) => ({
        recipientId,
        envelopeItemId: alignmentItem.id,
        type: field.type,
        page: field.page,
        positionX: field.positionX,
        positionY: field.positionY,
        width: field.width,
        height: field.height,
        fieldMeta: field.fieldMeta,
      })),
    };

    const createAlignmentFieldsRes = await request.post(`${baseUrl}/envelope/field/create-many`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: alignmentFieldsRequest,
    });

    expect(createAlignmentFieldsRes.ok()).toBeTruthy();
    expect(createAlignmentFieldsRes.status()).toBe(200);

    // Step 7: Create fields for second PDF (field-meta fields)
    const fieldMetaFieldsRequest = {
      envelopeId: createdEnvelope.id,
      data: FIELD_META_TEST_FIELDS.map((field) => ({
        recipientId,
        envelopeItemId: fieldMetaItem.id,
        type: field.type,
        page: field.page,
        positionX: field.positionX,
        positionY: field.positionY,
        width: field.width,
        height: field.height,
        fieldMeta: field.fieldMeta,
      })),
    };

    const createFieldMetaFieldsRes = await request.post(`${baseUrl}/envelope/field/create-many`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: fieldMetaFieldsRequest,
    });

    expect(createFieldMetaFieldsRes.ok()).toBeTruthy();
    expect(createFieldMetaFieldsRes.status()).toBe(200);

    // Step 8: Verify final envelope structure
    const finalGetRes = await request.get(`${baseUrl}/envelope/${createdEnvelope.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(finalGetRes.ok()).toBeTruthy();
    const finalEnvelope = (await finalGetRes.json()) as TGetEnvelopeResponse;

    // Verify structure
    expect(finalEnvelope.envelopeItems.length).toBe(2);
    expect(finalEnvelope.recipients.length).toBe(1);
    expect(finalEnvelope.fields.length).toBe(
      ALIGNMENT_TEST_FIELDS.length + FIELD_META_TEST_FIELDS.length,
    );
    expect(finalEnvelope.title).toBe('Envelope Full Field Test');
    expect(finalEnvelope.type).toBe(EnvelopeType.DOCUMENT);

    console.log({
      createdEnvelopeId: finalEnvelope.id,
      userEmail: userA.email,
    });
  });
});
