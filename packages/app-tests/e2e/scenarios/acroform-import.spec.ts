import fs from 'node:fs';
import path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, RecipientRole } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import { expect, test } from '@playwright/test';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

const ACROFORM_FIXTURE = fs.readFileSync(path.join(__dirname, '../../../../assets/acroform-import-test.pdf'));

test.describe.configure({
  mode: 'parallel',
});

test.describe('AcroForm Import', () => {
  test('imports AcroForm widgets as Documenso fields assigned to the provided signer', async ({ request }) => {
    const { user, team } = await seedUser();
    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const payload: TCreateEnvelopePayload = {
      type: EnvelopeType.DOCUMENT,
      title: 'AcroForm document',
      recipients: [
        {
          email: 'signer@example.com',
          name: 'Signer',
          role: RecipientRole.SIGNER,
        },
      ],
    };

    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
    formData.append('files', new File([ACROFORM_FIXTURE], 'acroform-import-test.pdf', { type: 'application/pdf' }));

    const res = await request.post(`${baseUrl}/envelope/create`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: formData,
    });

    expect(res.ok()).toBeTruthy();

    const response = (await res.json()) as TCreateEnvelopeResponse;

    const envelope = await prisma.envelope.findUniqueOrThrow({
      where: { id: response.id },
      include: {
        envelopeItems: { include: { documentData: true } },
        recipients: true,
        fields: true,
      },
    });

    expect(envelope.recipients).toHaveLength(1);
    expect(envelope.recipients[0].email).toBe('signer@example.com');

    // Every imported field is assigned to the single signer.
    expect(envelope.fields.length).toBeGreaterThanOrEqual(8);
    expect(envelope.fields.every((f) => f.recipientId === envelope.recipients[0].id)).toBe(true);

    // Every imported field has source: 'acroform' on its fieldMeta.
    for (const field of envelope.fields) {
      const meta = field.fieldMeta as { source?: string } | null;
      expect(meta?.source).toBe('acroform');
    }

    // FIELD_CREATED audit log entries match the number of imported fields.
    const auditEntries = await prisma.documentAuditLog.findMany({
      where: { envelopeId: envelope.id, type: 'FIELD_CREATED' },
    });

    expect(auditEntries.length).toBe(envelope.fields.length);
  });

  test('creates a placeholder Recipient 1 SIGNER when no recipients are provided', async ({ request }) => {
    const { user, team } = await seedUser();
    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const payload: TCreateEnvelopePayload = {
      type: EnvelopeType.DOCUMENT,
      title: 'AcroForm document without recipients',
    };

    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
    formData.append('files', new File([ACROFORM_FIXTURE], 'acroform-import-test.pdf', { type: 'application/pdf' }));

    const res = await request.post(`${baseUrl}/envelope/create`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: formData,
    });

    expect(res.ok()).toBeTruthy();

    const response = (await res.json()) as TCreateEnvelopeResponse;

    const envelope = await prisma.envelope.findUniqueOrThrow({
      where: { id: response.id },
      include: {
        recipients: true,
        fields: true,
      },
    });

    expect(envelope.recipients).toHaveLength(1);
    expect(envelope.recipients[0].email).toBe('recipient.1@documenso.com');
    expect(envelope.recipients[0].role).toBe(RecipientRole.SIGNER);
    expect(envelope.fields.length).toBeGreaterThanOrEqual(8);
    expect(envelope.fields.every((f) => f.recipientId === envelope.recipients[0].id)).toBe(true);
  });
});
