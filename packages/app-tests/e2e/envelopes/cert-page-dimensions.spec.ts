import { expect, test } from '@playwright/test';
import { DocumentStatus, EnvelopeType, FieldType } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import { getEnvelopeItemPdfUrl } from '@documenso/lib/utils/envelope-download';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../../lib/constants/app';
import { createApiToken } from '../../../lib/server-only/public-api/create-api-token';
import { RecipientRole } from '../../../prisma/generated/types';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '../../../trpc/server/envelope-router/create-envelope.types';
import type { TDistributeEnvelopeRequest } from '../../../trpc/server/envelope-router/distribute-envelope.types';
import { apiSignin } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2`;

const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

test.describe.configure({ mode: 'parallel', timeout: 60000 });

test('cert and audit log pages match document page dimensions', async ({ page, request }) => {
  const { user, team } = await seedUser();

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'test',
    expiresIn: null,
  });

  const letterPdf = fs.readFileSync(path.join(__dirname, '../../../../assets/letter-size.pdf'));

  const formData = new FormData();

  const createEnvelopePayload: TCreateEnvelopePayload = {
    type: EnvelopeType.DOCUMENT,
    title: 'Letter Size Dimension Test',
    recipients: [
      {
        email: user.email,
        name: user.name || '',
        role: RecipientRole.SIGNER,
        fields: [
          {
            identifier: 'letter-doc',
            type: FieldType.SIGNATURE,
            fieldMeta: { type: 'signature' },
            page: 1,
            positionX: 0.1,
            positionY: 0.1,
            width: 0.3,
            height: 0.05,
          },
        ],
      },
    ],
  };

  formData.append('payload', JSON.stringify(createEnvelopePayload));
  formData.append('files', new File([letterPdf], 'letter-doc', { type: 'application/pdf' }));

  const createResponse = await request.post(`${baseUrl}/envelope/create`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: formData,
  });

  expect(createResponse.ok()).toBeTruthy();

  const { id: envelopeId }: TCreateEnvelopeResponse = await createResponse.json();

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
    include: { recipients: true },
  });

  const distributeResponse = await request.post(`${baseUrl}/envelope/distribute`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { envelopeId: envelope.id } satisfies TDistributeEnvelopeRequest,
  });

  expect(distributeResponse.ok()).toBeTruthy();

  const recipientToken = envelope.recipients[0].token;
  const signUrl = `/sign/${recipientToken}`;

  await apiSignin({
    page,
    email: user.email,
    redirectPath: signUrl,
  });

  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(`${signUrl}/complete`);

  await expect(async () => {
    const { status } = await prisma.envelope.findFirstOrThrow({
      where: { id: envelope.id },
    });

    expect(status).toBe(DocumentStatus.COMPLETED);
  }).toPass({ timeout: 10000 });

  const completedEnvelope = await prisma.envelope.findFirstOrThrow({
    where: { id: envelope.id },
    include: {
      envelopeItems: {
        orderBy: { order: 'asc' },
        include: { documentData: true },
      },
    },
  });

  for (const item of completedEnvelope.envelopeItems) {
    const documentUrl = getEnvelopeItemPdfUrl({
      type: 'download',
      envelopeItem: item,
      token: recipientToken,
      version: 'signed',
    });

    const pdfData = await fetch(documentUrl).then(async (res) => await res.arrayBuffer());
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) });
    const pdf = await loadingTask.promise;

    expect(pdf.numPages).toBeGreaterThan(1);

    for (let i = 1; i <= pdf.numPages; i++) {
      const pdfPage = await pdf.getPage(i);
      const viewport = pdfPage.getViewport({ scale: 1 });

      expect(Math.round(viewport.width)).toBe(LETTER_WIDTH);
      expect(Math.round(viewport.height)).toBe(LETTER_HEIGHT);
    }
  }
});
