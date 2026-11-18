import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';

import {
  clickAddSignerButton,
  openDocumentEnvelopeEditor,
  openTemplateEnvelopeEditor,
  setRecipientEmail,
  setRecipientName,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';

/**
 * A newly added recipient is created by the first autosave, and the editor
 * must adopt the server-assigned id for subsequent saves. Historically the id
 * was never synced back into the form while staying on the recipients step,
 * so every following autosave resent the signer id-less — the server deleted
 * the previously created row and recreated it with a fresh id and signing
 * token, polluting the audit log with removed/added pairs on every edit.
 */

const getRecipientByEmail = async (surface: TEnvelopeEditorSurface, email: string) => {
  const { envelopeId } = surface;

  if (!envelopeId) {
    throw new Error('Expected surface to have an envelope ID');
  }

  await expect.poll(async () => prisma.recipient.count({ where: { envelopeId, email } }), { timeout: 15_000 }).toBe(1);

  return await prisma.recipient.findFirstOrThrow({ where: { envelopeId, email } });
};

const waitForRecipientName = async (surface: TEnvelopeEditorSurface, email: string, name: string) => {
  await expect
    .poll(
      async () => {
        const recipient = await prisma.recipient.findFirst({
          where: { envelopeId: surface.envelopeId, email },
        });

        return recipient?.name;
      },
      { timeout: 15_000 },
    )
    .toBe(name);
};

test.describe('document editor', () => {
  test('documents: recipient id and token remain stable across autosaves', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { root, envelopeId } = surface;

    await setRecipientEmail(root, 0, 'alice@example.com');
    await setRecipientName(root, 0, 'Alice');

    const aliceInitial = await getRecipientByEmail(surface, 'alice@example.com');

    // Edit while staying on the recipients step: the same row must be
    // updated, not deleted and recreated.
    await setRecipientName(root, 0, 'Alice Two');
    await waitForRecipientName(surface, 'alice@example.com', 'Alice Two');

    const aliceAfterEdit = await getRecipientByEmail(surface, 'alice@example.com');

    expect(aliceAfterEdit.id).toBe(aliceInitial.id);
    expect(aliceAfterEdit.token).toBe(aliceInitial.token);

    // Adding another signer resends the whole set — alice must survive it,
    // and bob must then survive an edit to alice.
    await clickAddSignerButton(root);
    await setRecipientEmail(root, 1, 'bob@example.com');

    const bobInitial = await getRecipientByEmail(surface, 'bob@example.com');

    await setRecipientName(root, 0, 'Alice Three');
    await waitForRecipientName(surface, 'alice@example.com', 'Alice Three');

    const aliceFinal = await getRecipientByEmail(surface, 'alice@example.com');
    const bobFinal = await getRecipientByEmail(surface, 'bob@example.com');

    expect(aliceFinal.id).toBe(aliceInitial.id);
    expect(aliceFinal.token).toBe(aliceInitial.token);
    expect(bobFinal.id).toBe(bobInitial.id);
    expect(bobFinal.token).toBe(bobInitial.token);

    // One creation per recipient and zero deletions in the audit trail.
    const auditLogs = await prisma.documentAuditLog.findMany({
      where: {
        envelopeId,
        type: {
          in: [DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED, DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED],
        },
      },
    });

    const createdCount = auditLogs.filter((log) => log.type === DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED).length;
    const deletedCount = auditLogs.filter((log) => log.type === DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED).length;

    expect(deletedCount).toBe(0);
    expect(createdCount).toBe(2);
  });
});

test.describe('template editor', () => {
  test('templates: recipient id and token remain stable across autosaves', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const { root } = surface;

    await setRecipientEmail(root, 0, 'alice@example.com');
    await setRecipientName(root, 0, 'Alice');

    const aliceInitial = await getRecipientByEmail(surface, 'alice@example.com');

    await setRecipientName(root, 0, 'Alice Two');
    await waitForRecipientName(surface, 'alice@example.com', 'Alice Two');

    const aliceAfterEdit = await getRecipientByEmail(surface, 'alice@example.com');

    expect(aliceAfterEdit.id).toBe(aliceInitial.id);
    expect(aliceAfterEdit.token).toBe(aliceInitial.token);
  });
});
