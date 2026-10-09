import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prefixedId } from '@documenso/lib/universal/id';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { seedDraftDocument } from '@documenso/prisma/seed/documents';
import { type APIRequestContext, expect, test } from '@playwright/test';

import { apiCreateTestContext } from '../../fixtures/api-seeds';
import { apiSignin } from '../../fixtures/authentication';

type DownloadCase = {
  client: APIRequestContext;
  path: string;
  headers?: Record<string, string>;
};

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

for (const { internalVersion, itemCount } of [
  { internalVersion: 1, itemCount: 1 },
  { internalVersion: 2, itemCount: 1 },
  { internalVersion: 2, itemCount: 2 },
]) {
  test(`download filenames after renaming a V${internalVersion} ${itemCount}-item envelope`, async ({
    page,
    request,
  }) => {
    const { user, team, token } = await apiCreateTestContext();
    const document = await seedDraftDocument(user, team.id, [user.email], {
      internalVersion,
      createDocumentOptions: { title: 'original-upload.pdf' },
    });

    const items = [...document.envelopeItems];

    if (itemCount === 2) {
      items.push(
        await prisma.envelopeItem.create({
          data: {
            id: prefixedId('envelope_item'),
            envelope: { connect: { id: document.id } },
            title: 'Supporting document.pdf',
            order: 2,
            documentData: {
              create: {
                type: items[0].documentData.type,
                data: items[0].documentData.data,
                initialData: items[0].documentData.initialData,
              },
            },
          },
          include: { documentData: true },
        }),
      );
    }

    // Renaming changes only the envelope title, leaving the upload's item title intact.
    const envelope = await prisma.envelope.update({
      where: { id: document.id },
      data: { title: 'Renamed agreement.pdf', qrToken: `qr_${document.id}` },
      include: { recipients: true },
    });

    await apiSignin({ page, email: user.email });

    for (const item of items) {
      const baseTitle = itemCount === 1 ? 'Renamed agreement' : item.title.replace(/\.pdf$/, '');

      for (const version of ['original', 'signed'] as const) {
        const filename = `${baseTitle}${version === 'signed' ? '_signed' : ''}.pdf`;
        const downloads: DownloadCase[] = [
          {
            client: page.request,
            path: `/api/files/envelope/${envelope.id}/envelopeItem/${item.id}/download/${version}`,
          },
          ...[envelope.recipients[0].token, envelope.qrToken].map((recipientToken) => ({
            client: request,
            path: `/api/files/token/${recipientToken}/envelopeItem/${item.id}/download/${version}`,
          })),
          {
            client: request,
            path: `/api/v2-beta/envelope/item/${item.id}/download?version=${version}`,
            headers: { Authorization: `Bearer ${token}` },
          },
        ];

        for (const { client, path, headers } of downloads) {
          const response = await client.get(`${WEBAPP_BASE_URL}${path}`, { headers });

          expect(response.status(), path).toBe(200);
          expect(response.headers()['content-disposition'], path).toBe(`attachment; filename="${filename}"`);
        }
      }
    }

    const legacyResponse = await request.get(
      `${WEBAPP_BASE_URL}/api/v2-beta/document/${mapSecondaryIdToDocumentId(envelope.secondaryId)}/download`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    expect(legacyResponse.status()).toBe(200);
    expect(legacyResponse.headers()['content-disposition']).toBe(
      `attachment; filename="${itemCount === 1 ? 'Renamed agreement' : 'original-upload'}_signed.pdf"`,
    );
  });
}
