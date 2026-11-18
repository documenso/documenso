import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';
import {
  DocumentStatus,
  DocumentVisibility,
  EnvelopeType,
  FieldType,
  RecipientRole,
  TeamMemberRole,
} from '@documenso/prisma/client';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import type { TImportAcroFormFieldsRequest } from '@documenso/trpc/server/envelope-router/import-acroform-fields.types';
import { PDF } from '@libpdf/core';
import { type APIRequestContext, expect, test } from '@playwright/test';

import { apiSignin, apiSignout, WEBAPP_ORIGIN_HEADERS } from '../../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

// Two text fields, a checkbox and a dropdown.
const formFieldsPdf = fs.readFileSync(path.join(__dirname, '../../../../../../assets/form-fields-test.pdf'));

test.describe.configure({
  mode: 'parallel',
});

type Owner = Awaited<ReturnType<typeof seedUser>>;

/**
 * Upload the PDF through the API, so that the stored PDF is what a real upload stores.
 */
const createFormEnvelope = async (
  request: APIRequestContext,
  { user, team }: Owner,
  type: EnvelopeType = EnvelopeType.DOCUMENT,
) => {
  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'test',
    expiresIn: null,
  });

  const payload: TCreateEnvelopePayload = {
    type,
    title: 'PDF form',
    recipients: [{ email: 'signer@example.com', name: 'Signer', role: RecipientRole.SIGNER }],
  };

  const formData = new FormData();

  formData.append('payload', JSON.stringify(payload));
  formData.append('files', new File([formFieldsPdf], 'form-fields-test.pdf', { type: 'application/pdf' }));

  const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/create`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: formData,
  });

  expect(res.ok(), await res.text()).toBeTruthy();

  const { id }: TCreateEnvelopeResponse = await res.json();

  // Only the owner and team admins can open the envelope.
  const envelope = await prisma.envelope.update({
    where: { id },
    data: { visibility: DocumentVisibility.ADMIN },
    include: { envelopeItems: true, recipients: true },
  });

  return {
    teamId: team.id,
    input: {
      envelopeId: envelope.id,
      envelopeItemId: envelope.envelopeItems[0].id,
      recipientId: envelope.recipients[0].id,
    } satisfies TImportAcroFormFieldsRequest,
  };
};

const importFields = async (request: APIRequestContext, teamId: number, input: TImportAcroFormFieldsRequest) =>
  await request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.field.importFromPdf`, {
    headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json', 'x-team-id': teamId.toString() },
    data: JSON.stringify({ json: input }),
  });

const getStoredState = async (envelopeId: string) => {
  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
    include: {
      fields: { orderBy: { id: 'asc' } },
      envelopeItems: { include: { documentData: true } },
    },
  });

  const pdf = await PDF.load(await getFileServerSide(envelope.envelopeItems[0].documentData));

  return {
    fields: envelope.fields,
    documentDataId: envelope.envelopeItems[0].documentDataId,
    pdfFormFieldCount: pdf.getForm()?.fieldCount ?? 0,
  };
};

const expectNothingImported = async (envelopeId: string) => {
  const { fields, pdfFormFieldCount } = await getStoredState(envelopeId);

  expect(fields).toHaveLength(0);
  expect(pdfFormFieldCount).toBe(4);
};

const expectImported = async (request: APIRequestContext, teamId: number, input: TImportAcroFormFieldsRequest) => {
  const res = await importFields(request, teamId, input);

  expect(res.status(), await res.text()).toBe(200);
  expect((await res.json()).result.data.json).toEqual({ fieldsCreated: 4 });
};

test('[IMPORT_ACROFORM_FIELDS]: moves the PDF form fields to fields of the recipient', async ({ page }) => {
  const owner = await seedUser();
  const { teamId, input } = await createFormEnvelope(page.context().request, owner);

  const before = await getStoredState(input.envelopeId);

  expect(before.fields).toHaveLength(0);
  expect(before.pdfFormFieldCount).toBe(4);

  await apiSignin({ page, email: owner.user.email });
  await expectImported(page.context().request, teamId, input);

  const after = await getStoredState(input.envelopeId);

  expect(after.fields.map((field) => field.type)).toEqual([
    FieldType.TEXT,
    FieldType.TEXT,
    FieldType.CHECKBOX,
    FieldType.DROPDOWN,
  ]);
  expect(after.fields.every((field) => field.recipientId === input.recipientId)).toBe(true);
  expect(after.fields.every((field) => field.envelopeItemId === input.envelopeItemId)).toBe(true);
  expect(after.pdfFormFieldCount).toBe(0);

  expect(await prisma.documentData.findUnique({ where: { id: before.documentDataId } })).toBeNull();

  const auditLogCount = await prisma.documentAuditLog.count({
    where: { envelopeId: input.envelopeId, type: 'FIELD_CREATED' },
  });

  expect(auditLogCount).toBe(4);

  // The form is gone from the PDF, so a second import cannot duplicate the fields.
  const secondRes = await importFields(page.context().request, teamId, input);

  expect(secondRes.status()).toBe(200);
  expect((await secondRes.json()).result.data.json).toEqual({ fieldsCreated: 0 });
  expect((await getStoredState(input.envelopeId)).fields).toHaveLength(4);
});

test('[IMPORT_ACROFORM_FIELDS]: rejects a request with no session', async ({ page, request }) => {
  const owner = await seedUser();
  const { teamId, input } = await createFormEnvelope(request, owner);

  const res = await importFields(request, teamId, input);

  expect(res.status()).toBe(401);
  await expectNothingImported(input.envelopeId);

  await apiSignin({ page, email: owner.user.email });
  await expectImported(page.context().request, teamId, input);
});

type Scenario = {
  owner: Owner;
  outsider: Owner;
  member: Owner['user'];
};

const DENIED_CALLERS: {
  name: string;
  caller: (scenario: Scenario) => { email: string; teamId: number };
}[] = [
  {
    name: 'a user from another organisation',
    caller: ({ outsider }) => ({ email: outsider.user.email, teamId: outsider.team.id }),
  },
  {
    name: 'a user from another organisation who sends the team ID of the owner',
    caller: ({ outsider, owner }) => ({ email: outsider.user.email, teamId: owner.team.id }),
  },
  {
    name: 'a team member whose role is below the visibility of the document',
    caller: ({ member, owner }) => ({ email: member.email, teamId: owner.team.id }),
  },
];

for (const { name, caller } of DENIED_CALLERS) {
  test(`[IMPORT_ACROFORM_FIELDS]: rejects ${name}`, async ({ page }) => {
    const owner = await seedUser();
    const outsider = await seedUser();
    const member = await seedTeamMember({ teamId: owner.team.id, role: TeamMemberRole.MEMBER });

    const { teamId, input } = await createFormEnvelope(page.context().request, owner);
    const { email, teamId: callerTeamId } = caller({ owner, outsider, member });

    await apiSignin({ page, email });

    const res = await importFields(page.context().request, callerTeamId, input);

    expect(res.status()).toBe(404);
    await expectNothingImported(input.envelopeId);

    await apiSignout({ page });
    await apiSignin({ page, email: owner.user.email });
    await expectImported(page.context().request, teamId, input);
  });
}

test('[IMPORT_ACROFORM_FIELDS]: rejects a recipient or an item of another envelope', async ({ page }) => {
  const owner = await seedUser();
  const { teamId, input } = await createFormEnvelope(page.context().request, owner);
  const { input: otherInput } = await createFormEnvelope(page.context().request, owner);

  await apiSignin({ page, email: owner.user.email });

  const recipientRes = await importFields(page.context().request, teamId, {
    ...input,
    recipientId: otherInput.recipientId,
  });

  expect(recipientRes.status()).toBe(400);

  const itemRes = await importFields(page.context().request, teamId, {
    ...input,
    envelopeItemId: otherInput.envelopeItemId,
  });

  expect(itemRes.status()).toBe(404);

  await expectNothingImported(input.envelopeId);
  await expectNothingImported(otherInput.envelopeId);

  await expectImported(page.context().request, teamId, input);
});

test('[IMPORT_ACROFORM_FIELDS]: rejects a template and a document that is not a draft', async ({ page }) => {
  const owner = await seedUser();
  const template = await createFormEnvelope(page.context().request, owner, EnvelopeType.TEMPLATE);
  const document = await createFormEnvelope(page.context().request, owner);

  await prisma.envelope.update({
    where: { id: document.input.envelopeId },
    data: { status: DocumentStatus.PENDING },
  });

  await apiSignin({ page, email: owner.user.email });

  const templateRes = await importFields(page.context().request, template.teamId, template.input);

  expect(templateRes.status()).toBe(404);
  await expectNothingImported(template.input.envelopeId);

  const pendingRes = await importFields(page.context().request, document.teamId, document.input);

  expect(pendingRes.status()).toBe(400);
  await expectNothingImported(document.input.envelopeId);

  await prisma.envelope.update({
    where: { id: document.input.envelopeId },
    data: { status: DocumentStatus.DRAFT },
  });

  await expectImported(page.context().request, document.teamId, document.input);
});
