import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType } from '@prisma/client';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';

import { apiDistributeEnvelope, apiSeedDraftDocument } from '../fixtures/api-seeds';

// Text lifted directly from `assets/example.pdf` page 1 (see Step 0 of the
// redaction test plan). KNOWN_TOP_TEXT sits at y~663 (near the top of the
// page, where we place the redaction). KNOWN_BOTTOM_TEXT sits at y~240,
// which rasterize-replace also erases because it redraws the entire page.
const KNOWN_TOP_TEXT = 'OPEN SOURCE PRINCIPLES WAIVER';
const KNOWN_BOTTOM_TEXT = 'Signature';

test.describe('redaction pipeline', () => {
  test('sender-placed redaction truly removes text from the distributed PDF', async ({
    request,
  }) => {
    test.setTimeout(120_000);

    // 1. Create a draft envelope with example.pdf attached, one SIGNER recipient,
    //    and one required SIGNATURE field. apiSeedDraftDocument uploads the real
    //    example.pdf via the API so the envelope item's DocumentData has the raw
    //    bytes we expect.
    const { envelope, token } = await apiSeedDraftDocument(request, {
      title: '[TEST] Redaction Round-Trip',
      recipients: [
        {
          email: `signer-redaction-${Date.now()}@test.documenso.com`,
          name: 'Redaction Signer',
          role: 'SIGNER',
        },
      ],
      fieldsPerRecipient: [
        [
          {
            type: FieldType.SIGNATURE,
            page: 1,
            positionX: 50,
            positionY: 80,
            width: 20,
            height: 10,
          },
        ],
      ],
    });

    expect(envelope.envelopeItems.length).toBeGreaterThan(0);
    const envelopeItemId = envelope.envelopeItems[0].id;

    // Sanity check: the freshly uploaded PDF still contains the known text.
    // This guards against a future change to example.pdf that would make the
    // test's "absent after redaction" assertion vacuously true.
    const originalEnvelopeItem = await prisma.envelopeItem.findUniqueOrThrow({
      where: { id: envelopeItemId },
      include: { documentData: true },
    });
    const originalBytes = await getFileServerSide(originalEnvelopeItem.documentData);
    const originalText = await extractPage1Text(originalBytes);
    expect(originalText).toContain(KNOWN_TOP_TEXT);
    expect(originalText).toContain(KNOWN_BOTTOM_TEXT);

    // 2. Insert a redaction row directly via Prisma. positionX/positionY/width/height
    //    are percentages of the page. Cover the top 15% of the page where
    //    KNOWN_TOP_TEXT lives.
    await prisma.redaction.create({
      data: {
        envelopeId: envelope.id,
        envelopeItemId: envelopeItemId,
        page: 1,
        positionX: 5,
        positionY: 5,
        width: 90,
        height: 15,
      },
    });

    // 3. Distribute the envelope via the V2 API. This triggers the same
    //    sendDocument path a real user's "Send" click would, including the
    //    applyRedactionsToDocument pipeline.
    await apiDistributeEnvelope(request, token, envelope.id);

    // 4. Poll until the envelope reaches PENDING and the redaction rows are
    //    gone (sendDocument deletes them after baking them into the PDF).
    //    This is proof that the pipeline ran to completion.
    await expect
      .poll(
        async () => {
          const dbEnvelope = await prisma.envelope.findUniqueOrThrow({
            where: { id: envelope.id },
            include: { redactions: true },
          });
          return {
            status: dbEnvelope.status,
            redactionCount: dbEnvelope.redactions.length,
          };
        },
        { timeout: 60_000, intervals: [500, 1000, 2000] },
      )
      .toEqual({ status: DocumentStatus.PENDING, redactionCount: 0 });

    // 5. Read the current DocumentData for the envelope item and extract
    //    page 1 text from the distributed PDF bytes.
    const bakedEnvelopeItem = await prisma.envelopeItem.findUniqueOrThrow({
      where: { id: envelopeItemId },
      include: { documentData: true },
    });

    const pdfBytes = await getFileServerSide(bakedEnvelopeItem.documentData);
    const text = await extractPage1Text(pdfBytes);

    // 6. Security-critical assertions: the known text MUST be absent from
    //    the distributed PDF. This is the whole point of true redaction —
    //    not just an opaque overlay, but the underlying text stream
    //    actually rewritten so copy/paste and text extraction return
    //    nothing for the redacted region (and, for rasterize-replace, the
    //    entire page's text stream).
    expect(text).not.toContain(KNOWN_TOP_TEXT);
    expect(text).not.toContain(KNOWN_BOTTOM_TEXT);
  });
});

const extractPage1Text = async (pdfBytes: Uint8Array): Promise<string> => {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;

  try {
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
  } finally {
    await pdf.destroy();
  }
};
