import { expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { incrementDocumentId } from '@documenso/lib/server-only/envelope/increment-id';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import {
  DocumentSource,
  DocumentVisibility,
  EnvelopeType,
  RecipientRole,
} from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TCreateEnvelopeItemsRequest } from '@documenso/trpc/server/envelope-router/create-envelope-items.types';
import type { TCreateEnvelopeRecipientsRequest } from '@documenso/trpc/server/envelope-router/envelope-recipients/create-envelope-recipients.types';
import type { TGetEnvelopeResponse } from '@documenso/trpc/server/envelope-router/get-envelope.types';
import type { TUpdateEnvelopeRequest } from '@documenso/trpc/server/envelope-router/update-envelope.types';

import { formatAlignmentTestFields } from '../../../constants/field-alignment-pdf';
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

  /**
   * Creates envelopes with the two field test PDFs.
   */
  test('Envelope full test', async ({ request }) => {
    // Step 1: Create initial envelope with Prisma (with first envelope item)
    const alignmentPdf = fs
      .readFileSync(path.join(__dirname, '../../../../../assets/field-font-alignment.pdf'))
      .toString('base64');

    const fieldMetaPdf = fs
      .readFileSync(path.join(__dirname, '../../../../../assets/field-meta.pdf'))
      .toString('base64');

    const alignmentDocumentData = await prisma.documentData.create({
      data: {
        type: 'BYTES_64',
        data: alignmentPdf,
        initialData: alignmentPdf,
      },
    });

    const documentId = await incrementDocumentId();
    const documentMeta = await prisma.documentMeta.create({
      data: {},
    });

    const createdEnvelope = await prisma.envelope.create({
      data: {
        id: prefixedId('envelope'),
        secondaryId: documentId.formattedDocumentId,
        internalVersion: 2,
        type: EnvelopeType.DOCUMENT,
        documentMetaId: documentMeta.id,
        source: DocumentSource.DOCUMENT,
        title: `Envelope Full Field Test`,
        status: 'DRAFT',
        userId: userA.id,
        teamId: teamA.id,
        envelopeItems: {
          create: {
            id: prefixedId('envelope_item'),
            title: `Alignment Test`,
            documentDataId: alignmentDocumentData.id,
            order: 1,
          },
        },
      },
      include: {
        envelopeItems: true,
      },
    });

    // Step 2: Create second envelope item via API
    const fieldMetaDocumentData = await prisma.documentData.create({
      data: {
        type: 'BYTES_64',
        data: fieldMetaPdf,
        initialData: fieldMetaPdf,
      },
    });

    const createEnvelopeItemsRequest: TCreateEnvelopeItemsRequest = {
      envelopeId: createdEnvelope.id,
      data: [
        {
          title: 'Field Meta Test',
          documentDataId: fieldMetaDocumentData.id,
        },
      ],
    };

    const createItemsRes = await request.post(`${baseUrl}/envelope/item/create-many`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: createEnvelopeItemsRequest,
    });

    expect(createItemsRes.ok()).toBeTruthy();
    expect(createItemsRes.status()).toBe(200);

    // Step 3: Update envelope via API
    const updateEnvelopeRequest: TUpdateEnvelopeRequest = {
      envelopeId: createdEnvelope.id,
      envelopeType: EnvelopeType.DOCUMENT,
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
      data: formatAlignmentTestFields.map((field) => ({
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
      formatAlignmentTestFields.length + FIELD_META_TEST_FIELDS.length,
    );
    expect(finalEnvelope.title).toBe('Envelope Full Field Test');
    expect(finalEnvelope.type).toBe(EnvelopeType.DOCUMENT);
  });
});
