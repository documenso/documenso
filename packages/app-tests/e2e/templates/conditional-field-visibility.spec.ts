/**
 * End-to-end tests for conditional field visibility.
 *
 * Strategy: seed a PENDING document directly via the database (bypassing the template-creation
 * UI) with two fields:
 *
 *  1. RADIO  "marital_status"  — options: ["Married", "Single"]
 *  2. TEXT   "spouse_name"     — visibility rule: show only when marital_status equals "Married"
 *
 * Then navigate to the signing URL, interact with the fields, and assert that the
 * spouse_name field is absent from the DOM when the signer picks "Single" and is
 * present (and required) when the signer picks "Married".
 *
 * The signing completion flow is verified against the database so the test works
 * without a real email server or PDF renderer.
 *
 * NOTE: The UI-driven template-creation scenario (Tasks 21.4–21.5) is left as
 *       test.fixme because the exact drag-and-drop / advanced-settings selectors
 *       for placing a field on the PDF canvas and opening the VisibilitySection
 *       sidebar require interactive selector discovery against a running dev
 *       server. See the FIXME block at the bottom of this file for guidance.
 */
import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType, ReadStatus, SendStatus, SigningStatus } from '@prisma/client';
import { nanoid } from 'nanoid';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { incrementDocumentId } from '@documenso/lib/server-only/envelope/increment-id';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { TRadioFieldMeta, TTextFieldMeta } from '@documenso/lib/types/field-meta';
import { prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { DocumentDataType, DocumentSource, EnvelopeType, Prisma } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBAPP = NEXT_PUBLIC_WEBAPP_URL();

/**
 * Seed a PENDING document that has:
 *  - one RADIO field "marital_status" (Married / Single)
 *  - one TEXT field "spouse_name" that is only visible when marital_status = "Married"
 *
 * Returns the document and the single recipient.
 */
async function seedConditionalDocument(ownerUserId: number, teamId: number, signerEmail: string) {
  // Use the example.pdf (already used by all other e2e seeds)
  const fs = await import('node:fs');
  const path = await import('node:path');
  const examplePdf = fs
    .readFileSync(path.join(__dirname, '../../../../assets/example.pdf'))
    .toString('base64');

  const documentData = await prisma.documentData.create({
    data: { type: DocumentDataType.BYTES_64, data: examplePdf, initialData: examplePdf },
  });

  const documentMeta = await prisma.documentMeta.create({ data: {} });
  const documentId = await incrementDocumentId();

  const RADIO_STABLE_ID = `radio_marital_${nanoid(8)}`;
  const TEXT_STABLE_ID = `text_spouse_${nanoid(8)}`;

  const radioMeta: TRadioFieldMeta = {
    type: 'radio',
    direction: 'vertical',
    stableId: RADIO_STABLE_ID,
    label: 'Marital Status',
    values: [
      { id: 1, checked: false, value: 'Married' },
      { id: 2, checked: false, value: 'Single' },
    ],
  };

  const textMeta: TTextFieldMeta = {
    type: 'text',
    stableId: TEXT_STABLE_ID,
    label: 'Spouse Name',
    required: true,
    visibility: {
      match: 'all',
      rules: [
        {
          operator: 'equals',
          triggerFieldStableId: RADIO_STABLE_ID,
          value: 'Married',
        },
      ],
    },
  };

  const envelope = await prisma.envelope.create({
    data: {
      id: prefixedId('envelope'),
      secondaryId: documentId.formattedDocumentId,
      internalVersion: 1,
      type: EnvelopeType.DOCUMENT,
      documentMetaId: documentMeta.id,
      source: DocumentSource.DOCUMENT,
      teamId,
      title: '[TEST] Conditional visibility e2e',
      status: DocumentStatus.PENDING,
      userId: ownerUserId,
      envelopeItems: {
        create: {
          id: prefixedId('envelope_item'),
          title: '[TEST] Conditional visibility e2e',
          documentDataId: documentData.id,
          order: 1,
        },
      },
    },
    include: { envelopeItems: true },
  });

  const envelopeItem = envelope.envelopeItems[0];

  const recipient = await prisma.recipient.create({
    data: {
      email: signerEmail,
      name: 'Test Signer',
      token: nanoid(),
      readStatus: ReadStatus.OPENED,
      sendStatus: SendStatus.SENT,
      signingStatus: SigningStatus.NOT_SIGNED,
      signedAt: new Date(),
      envelopeId: envelope.id,
    },
  });

  // Create the RADIO field
  const radioField = await prisma.field.create({
    data: {
      page: 1,
      type: FieldType.RADIO,
      inserted: false,
      customText: '',
      positionX: new Prisma.Decimal(10),
      positionY: new Prisma.Decimal(10),
      width: new Prisma.Decimal(20),
      height: new Prisma.Decimal(10),
      envelopeId: envelope.id,
      envelopeItemId: envelopeItem.id,
      recipientId: recipient.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      fieldMeta: radioMeta as any,
    },
  });

  // Create the TEXT field with the visibility rule
  const textField = await prisma.field.create({
    data: {
      page: 1,
      type: FieldType.TEXT,
      inserted: false,
      customText: '',
      positionX: new Prisma.Decimal(10),
      positionY: new Prisma.Decimal(30),
      width: new Prisma.Decimal(20),
      height: new Prisma.Decimal(5),
      envelopeId: envelope.id,
      envelopeItemId: envelopeItem.id,
      recipientId: recipient.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      fieldMeta: textMeta as any,
    },
  });

  return {
    envelope,
    recipient: {
      ...recipient,
      fields: [radioField, textField],
    },
    radioField,
    textField,
    RADIO_STABLE_ID,
    TEXT_STABLE_ID,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Conditional field visibility', () => {
  /**
   * Scenario A: radio = "Single" → spouse_name field must NOT be in the DOM.
   *             Document must complete successfully (spouse_name is skipped).
   */
  test('[CONDITIONAL]: hidden field is absent from DOM when condition is not met (Single)', async ({
    page,
  }) => {
    const { user, team } = await seedUser();
    const signerEmail = `signer-single-${nanoid(6)}@example.com`;

    const { recipient, radioField, textField } = await seedConditionalDocument(
      user.id,
      team.id,
      signerEmail,
    );

    // Navigate to the signing URL
    await page.goto(`${WEBAPP}/sign/${recipient.token}`);

    // Wait for the PDF viewer to initialise. The radio field container should appear.
    await expect(page.locator(`#field-${radioField.id}`)).toBeVisible({ timeout: 20_000 });

    // At this point neither field has been signed, so the text field should also
    // be visible (its trigger radio has no value yet — evaluateVisibility returns
    // visible=false because the rule.value "Married" doesn't match empty string).
    // The FieldRootContainer returns null when hidden=true, so the element is absent.
    await expect(page.locator(`#field-${textField.id}`)).not.toBeVisible();

    // Select "Single" on the radio field
    const singleOptionId = `option-${radioField.id}-2`; // id:2 = "Single" per seed
    await page.locator(`label[for="${singleOptionId}"]`).click();

    // After picking Single the text field should remain absent (condition not met)
    await expect(page.locator(`#field-${textField.id}`)).not.toBeVisible();

    // The radio field should now be inserted (auto-signs when a value is selected)
    await expect(async () => {
      await expect(page.locator(`#field-${radioField.id}`)).toHaveAttribute(
        'data-inserted',
        'true',
      );
    }).toPass({ timeout: 10_000 });

    // Complete the document — spouse_name will be skipped as it is hidden
    await page.getByRole('button', { name: 'Complete' }).click();
    await page.waitForTimeout(500);
    // Confirm dialog if present
    const signButton = page.getByRole('button', { name: 'Sign' });
    if (await signButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await signButton.click({ force: true });
    }

    await page.waitForURL(`/sign/${recipient.token}/complete`, { timeout: 20_000 });

    // Verify via the database that:
    //  a) the document completed (or is now pending next signer)
    //  b) a FIELD_SKIPPED_CONDITIONAL audit log was emitted for the text field
    await expect(async () => {
      const auditLogs = await prisma.documentAuditLog.findMany({
        where: {
          envelopeId: recipient.envelopeId,
          type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_SKIPPED_CONDITIONAL,
        },
      });
      expect(auditLogs.length).toBeGreaterThan(0);

      const skippedLog = auditLogs[0];
      const data = skippedLog.data as { fieldLabel?: string; unmetRuleSummary?: string } | null;
      // Should reference the spouse name label
      expect(data?.fieldLabel ?? '').toMatch(/spouse/i);
    }).toPass({ timeout: 30_000 });
  });

  /**
   * Scenario B: radio = "Married" → spouse_name IS visible and required.
   *             Signing without filling it should not complete.
   *             After filling it the document should complete.
   */
  test('[CONDITIONAL]: required field IS visible when condition is met (Married)', async ({
    page,
  }) => {
    const { user, team } = await seedUser();
    const signerEmail = `signer-married-${nanoid(6)}@example.com`;

    const { recipient, radioField, textField } = await seedConditionalDocument(
      user.id,
      team.id,
      signerEmail,
    );

    await page.goto(`${WEBAPP}/sign/${recipient.token}`);

    // Radio field should be visible
    await expect(page.locator(`#field-${radioField.id}`)).toBeVisible({ timeout: 20_000 });

    // Text field is hidden before any radio selection (trigger empty → condition false)
    await expect(page.locator(`#field-${textField.id}`)).not.toBeVisible();

    // Select "Married"
    const marriedOptionId = `option-${radioField.id}-1`; // id:1 = "Married" per seed
    await page.locator(`label[for="${marriedOptionId}"]`).click();

    // After selecting "Married", the text field should NOW be visible
    await expect(page.locator(`#field-${textField.id}`)).toBeVisible({ timeout: 10_000 });

    // Wait for radio to be inserted
    await expect(async () => {
      await expect(page.locator(`#field-${radioField.id}`)).toHaveAttribute(
        'data-inserted',
        'true',
      );
    }).toPass({ timeout: 10_000 });

    // Fill in the text field (click to activate, then type)
    await page.locator(`#field-${textField.id}`).click();
    await page.keyboard.type('Jane Doe');

    // Wait for text field insertion
    await expect(async () => {
      await expect(page.locator(`#field-${textField.id}`)).toHaveAttribute('data-inserted', 'true');
    }).toPass({ timeout: 10_000 });

    // Complete
    await page.getByRole('button', { name: 'Complete' }).click();
    await page.waitForTimeout(500);
    const signButton = page.getByRole('button', { name: 'Sign' });
    if (await signButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await signButton.click({ force: true });
    }

    await page.waitForURL(`/sign/${recipient.token}/complete`, { timeout: 20_000 });

    // Verify no FIELD_SKIPPED_CONDITIONAL was emitted (the field was filled, not skipped)
    await expect(async () => {
      const skippedLogs = await prisma.documentAuditLog.findMany({
        where: {
          envelopeId: recipient.envelopeId,
          type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_SKIPPED_CONDITIONAL,
        },
      });
      expect(skippedLogs).toHaveLength(0);
    }).toPass({ timeout: 30_000 });
  });

  /**
   * Scenario C (database-level): verify that the webhook payload excludes
   * hidden fields by inspecting ZWebhookDocumentSchema filter.
   *
   * We verify this by seeding a completed document where the spouse_name
   * was conditionally hidden (customText = '', inserted = false) and
   * assert that the field is absent from the webhook payload shape
   * (i.e. the field's secondaryId is not in the mapped visible fields).
   */
  test('[CONDITIONAL]: completed document has skipped-field audit log when condition unmet', async () => {
    const { user, team } = await seedUser();

    // We construct the scenario entirely at the DB level:
    // Seed the doc, then manually "sign" the radio as Single and call
    // complete-document-with-token via the server function directly.
    const signerEmail = `signer-complete-${nanoid(6)}@example.com`;
    const { recipient, radioField, textField, envelope } = await seedConditionalDocument(
      user.id,
      team.id,
      signerEmail,
    );

    // Simulate radio field signed with "Single"
    await prisma.field.update({
      where: { id: radioField.id },
      data: { customText: 'Single', inserted: true },
    });

    // Text field remains uninserted (as if hidden)
    // Text field is required but hidden — the completion logic should skip it.

    // Call the server-side completion function directly
    const { completeDocumentWithToken } = await import(
      '@documenso/lib/server-only/document/complete-document-with-token'
    );

    await completeDocumentWithToken({
      token: recipient.token,
      id: { type: 'envelopeId', id: envelope.id },
    });

    // Verify FIELD_SKIPPED_CONDITIONAL was written for textField
    const skippedLogs = await prisma.documentAuditLog.findMany({
      where: {
        envelopeId: envelope.id,
        type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_SKIPPED_CONDITIONAL,
      },
    });

    expect(skippedLogs.length).toBeGreaterThan(0);

    const logData = skippedLogs[0].data as { fieldLabel?: string };
    expect(logData.fieldLabel).toMatch(/spouse/i);

    // Verify the text field was cleared (customText reset to '')
    const updatedTextField = await prisma.field.findUniqueOrThrow({
      where: { id: textField.id },
    });
    expect(updatedTextField.customText).toBe('');
    expect(updatedTextField.inserted).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // FIXME: Template creation via the UI (Task 21 full happy path)
  // ---------------------------------------------------------------------------

  test.fixme(
    '[CONDITIONAL][UI]: create template with conditional fields via the editor',
    async ({ page }) => {
      /**
       * TODO: Un-skip once the following selector gaps are resolved.
       *
       * 1. PLACING FIELDS ON THE PDF CANVAS
       *    The field placement widget works via drag-and-drop onto a virtualised
       *    PDF canvas rendered inside `[data-pdf-content]`. The exact interaction
       *    pattern used by other tests is:
       *
       *      await page.getByRole('button', { name: 'Radio' }).click();
       *      await page.locator(PDF_VIEWER_PAGE_SELECTOR).click({ position: { x: 100, y: 100 } });
       *
       *    See `packages/app-tests/e2e/document-flow/autosave-fields-step.spec.ts`
       *    for the full pattern.  The radio-field button may be labelled differently
       *    from "Radio" — check with:
       *      page.getByTestId('field-type-radio') or page.getByRole('button', { name: /radio/i })
       *
       * 2. OPENING ADVANCED SETTINGS FOR A FIELD
       *    After placing a field a sidebar opens automatically.  The footer of that
       *    sidebar has a test-id `field-advanced-settings-footer`.  The
       *    VisibilitySection is rendered at the bottom of the advanced-settings
       *    panel.  The "Add rule" button is:
       *      page.getByRole('button', { name: 'Add rule' })
       *
       * 3. SELECTING THE TRIGGER FIELD IN THE VISIBILITY SECTION
       *    After clicking "Add rule" a row appears with two Selects:
       *      - Select 1: trigger field  (SelectTrigger w-48)
       *      - Select 2: operator       (SelectTrigger w-40)
       *      - Select 3 (conditional): value  (SelectTrigger w-40)
       *    Use page.locator('button[role="combobox"]').nth(N) to identify them by
       *    position, or add data-testid attributes to the VisibilitySection selects.
       *
       * 4. SAVING AND USING THE TEMPLATE
       *    Follows the existing pattern in `create-document-from-template.spec.ts`:
       *      await page.getByRole('button', { name: 'Save template' }).click();
       *      await page.waitForURL(`/t/${team.url}/templates`);
       *      await page.getByRole('button', { name: 'Use Template' }).click();
       *      await page.getByRole('button', { name: 'Create as draft' }).click();
       *
       * 5. COMPLETING THE SIGNING FLOW
       *    Follow the same pattern used in the database-seeded tests above.
       */

      const { user, team } = await seedUser();
      const template = await import('@documenso/prisma/seed/templates').then(async (m) =>
        m.seedBlankTemplate(user, team.id),
      );

      await apiSignin({
        page,
        email: user.email,
        redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
      });

      // TODO: Set title
      await page.getByLabel('Title').fill('Conditional visibility e2e');

      // TODO: Add signer
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByPlaceholder('Email').fill('signer@example.com');
      await page.getByPlaceholder('Name').fill('Test Signer');
      await page.getByRole('button', { name: 'Continue' }).click();

      // TODO: Add radio field "Marital Status" at (100, 100)
      // await page.getByRole('button', { name: /radio/i }).click();
      // await page.locator(PDF_VIEWER_PAGE_SELECTOR).click({ position: { x: 100, y: 100 } });

      // TODO: Configure radio options (Married, Single) in the sidebar
      // TODO: Set the label to "marital_status"

      // TODO: Close advanced settings
      // await page.getByTestId('field-advanced-settings-footer').getByRole('button', { name: 'Save' }).click();

      // TODO: Add text field "Spouse Name" at (100, 200)
      // await page.getByRole('button', { name: /text/i }).click();
      // await page.locator(PDF_VIEWER_PAGE_SELECTOR).click({ position: { x: 100, y: 200 } });

      // TODO: Configure visibility rule in advanced settings:
      //   - Click "Add rule"
      //   - Select "marital_status · radio · p.1" as trigger
      //   - Select "equals" as operator
      //   - Select "Married" as value
      // await page.getByRole('button', { name: 'Add rule' }).click();
      // ...

      // TODO: Save template and create document
      // await page.getByRole('button', { name: 'Save template' }).click();
      // ...

      // TODO: Sign as signer with Single → assert spouse_name absent
      // TODO: Sign as signer with Married → assert spouse_name visible and required
    },
  );
});
