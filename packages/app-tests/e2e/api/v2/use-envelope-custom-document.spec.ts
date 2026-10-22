import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TUseEnvelopePayload,
  TUseEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/use-envelope.types';
import { type APIRequestContext, expect, test } from '@playwright/test';
import { DocumentDataType } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

const examplePdf = fs.readFileSync(path.join(__dirname, '../../../../../assets/example.pdf'));

const TEMPLATE_ITEM_TITLE = 'Template Item';

test.describe.configure({
  mode: 'parallel',
});

const seedTemplateWithApiToken = async () => {
  const { user, team } = await seedUser();

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'test',
    expiresIn: null,
  });

  const template = await seedTemplate({
    title: TEMPLATE_ITEM_TITLE,
    userId: user.id,
    teamId: team.id,
    internalVersion: 2,
  });

  return { token, template };
};

const addTemplateItem = async (templateId: string, title: string) => {
  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: examplePdf.toString('base64'),
      initialData: examplePdf.toString('base64'),
    },
  });

  return await prisma.envelopeItem.create({
    data: {
      id: prefixedId('envelope_item'),
      envelopeId: templateId,
      title,
      documentDataId: documentData.id,
      order: 2,
    },
  });
};

const useTemplate = async (request: APIRequestContext, token: string, payload: TUseEnvelopePayload, files: Blob[]) => {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));

  for (const file of files) {
    formData.append('files', file);
  }

  const res = await request.post(`${baseUrl}/envelope/use`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: formData,
  });

  expect(res.ok()).toBeTruthy();

  const { id }: TUseEnvelopeResponse = await res.json();

  return await prisma.envelopeItem.findMany({
    where: { envelopeId: id },
    orderBy: { order: 'asc' },
  });
};

test.describe('API V2 envelope use with custom documents', () => {
  test('names the envelope item after an uploaded .PDF file', async ({ request }) => {
    const { token, template } = await seedTemplateWithApiToken();

    const [envelopeItem] = await useTemplate(
      request,
      token,
      {
        envelopeId: template.id,
        customDocumentData: [{ identifier: 'Contract.PDF', envelopeItemId: template.envelopeItems[0].id }],
      },
      [new File([examplePdf], 'Contract.PDF', { type: 'application/pdf' })],
    );

    expect(envelopeItem.title).toBe('Contract');
  });

  test('keeps the template item title for a nameless upload', async ({ request }) => {
    const { token, template } = await seedTemplateWithApiToken();

    const [envelopeItem] = await useTemplate(
      request,
      token,
      {
        envelopeId: template.id,
        customDocumentData: [{ identifier: 0, envelopeItemId: template.envelopeItems[0].id }],
      },
      [new Blob([examplePdf], { type: 'application/pdf' })],
    );

    expect(envelopeItem.title).toBe(TEMPLATE_ITEM_TITLE);
  });

  test('maps a numeric identifier to the file at that upload index', async ({ request }) => {
    const { token, template } = await seedTemplateWithApiToken();
    const secondTemplateItem = await addTemplateItem(template.id, 'Second Template Item');

    const envelopeItems = await useTemplate(
      request,
      token,
      {
        envelopeId: template.id,
        customDocumentData: [{ identifier: 1, envelopeItemId: secondTemplateItem.id }],
      },
      [
        new File([examplePdf], 'Unused.pdf', { type: 'application/pdf' }),
        new File([examplePdf], 'Replacement.pdf', { type: 'application/pdf' }),
      ],
    );

    expect(envelopeItems.map((item) => item.title)).toEqual([TEMPLATE_ITEM_TITLE, 'Replacement']);
  });
});
