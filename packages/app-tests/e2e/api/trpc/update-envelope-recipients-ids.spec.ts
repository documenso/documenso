import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { seedTestEmail } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { FieldType, RecipientRole } from '@prisma/client';

import { apiSeedDraftDocument } from '../../fixtures/api-seeds';

const API_BASE_URL = `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta`;

test('rejects a recipient listed twice without changing it', async ({ request }) => {
  const { envelope, token } = await apiSeedDraftDocument(request, {
    recipients: [{ email: seedTestEmail(), name: 'Signer' }],
    fieldsPerRecipient: [[{ type: FieldType.SIGNATURE, page: 1, positionX: 5, positionY: 5, width: 20, height: 5 }]],
  });

  const [recipient] = envelope.recipients;

  // Each entry is checked against the stored recipient and then written in turn. The first would
  // delete the signature field, which a CC cannot have, and the second would store a signer
  // who then has none.
  const response = await request.post(`${API_BASE_URL}/envelope/recipient/update-many`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId: envelope.id,
      data: [
        { id: recipient.id, role: RecipientRole.CC },
        { id: recipient.id, role: RecipientRole.SIGNER },
      ],
    },
  });

  expect(response.status()).toBe(400);

  const storedRecipient = await prisma.recipient.findUniqueOrThrow({
    where: {
      id: recipient.id,
    },
    include: {
      fields: true,
    },
  });

  expect(storedRecipient.role).toBe(RecipientRole.SIGNER);
  expect(storedRecipient.fields.map((field) => field.type)).toEqual([FieldType.SIGNATURE]);
});
