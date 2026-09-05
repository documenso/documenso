import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { expect, type Page, test } from '@playwright/test';
import { DocumentSigningOrder } from '@prisma/client';

import {
  clickAddSignerButton,
  dragGroupCardOntoCard,
  getRecipientEmailInputs,
  getRecipientStepCards,
  moveGroupCardUp,
  openDocumentEnvelopeEditor,
  setRecipientEmail,
  sweepRecipientRowOverCard,
  type TEnvelopeEditorSurface,
  toggleSigningOrder,
} from '../fixtures/envelope-editor';

/**
 * Recipient signing groups are an SES feature: on AES/QES (CSC-mode)
 * instances every signing recipient must hold a distinct signing order, so
 * the editor must not offer the group affordances (card combine, row-to-card
 * join) while still allowing step reordering and ungrouping of invalid
 * API-created state.
 */

const GROUP_BADGE_TEXT = '2 recipients · any order';

/**
 * Forces the client bundle into CSC mode for this page.
 *
 * `IS_INSTANCE_CSC_MODE()` reads `window.__ENV__.NEXT_PUBLIC_SIGNING_TRANSPORT_IS_CSC`
 * on the client, and `window.__ENV__` is assigned by an inline script during
 * hydration — the property trap rewrites the flag whenever that assignment
 * happens, regardless of script ordering.
 *
 * Passed as a raw string: the test runner's esbuild transform decorates
 * serialized functions with `__name` helper calls that don't exist in the
 * browser, which would make the script throw before installing the trap.
 */
const forceCscClientMode = async (page: Page) => {
  await page.addInitScript(
    `(() => {
      let currentEnv;

      Object.defineProperty(window, '__ENV__', {
        configurable: true,
        get: () => currentEnv,
        set: (value) => {
          currentEnv = { ...value, NEXT_PUBLIC_SIGNING_TRANSPORT_IS_CSC: 'true' };
        },
      });
    })();`,
  );
};

/**
 * CSC envelopes are always SEQUENTIAL, but the seeded blank document defaults
 * to PARALLEL and the signing-order toggle is hidden in CSC mode — flip the
 * meta directly and reload so the editor renders the sequential step UI.
 */
const makeEnvelopeSequential = async (surface: TEnvelopeEditorSurface) => {
  if (!surface.envelopeId) {
    throw new Error('Expected surface to have an envelope ID');
  }

  await prisma.envelope.update({
    where: { id: surface.envelopeId },
    data: {
      documentMeta: {
        update: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
      },
    },
  });

  await surface.root.reload();
};

const setupTwoSequentialSigners = async (surface: TEnvelopeEditorSurface) => {
  const { root } = surface;

  await setRecipientEmail(root, 0, 'alice@example.com');

  await clickAddSignerButton(root);
  await setRecipientEmail(root, 1, 'bob@example.com');

  await expect(getRecipientStepCards(root)).toHaveCount(2);
};

const expectRecipientOrders = async (surface: TEnvelopeEditorSurface, expected: Array<[string, number]>) => {
  const { envelopeId } = surface;

  if (!envelopeId) {
    throw new Error('Expected surface to have an envelope ID');
  }

  await expect
    .poll(
      async () => {
        const recipients = await prisma.recipient.findMany({
          where: { envelopeId },
        });

        return recipients.map((r) => [r.email, r.signingOrder] as const).sort((a, b) => a[0].localeCompare(b[0]));
      },
      { timeout: 15_000 },
    )
    .toEqual([...expected].sort((a, b) => a[0].localeCompare(b[0])));
};

test.describe('document editor (csc mode)', () => {
  test('csc: merging step cards into a group is unavailable', async ({ page }) => {
    await forceCscClientMode(page);

    const surface = await openDocumentEnvelopeEditor(page);

    await makeEnvelopeSequential(surface);
    await setupTwoSequentialSigners(surface);

    // The keyboard combine helper throws when the target card never enters
    // the combine state — exactly what "combining is disabled" looks like.
    await expect(dragGroupCardOntoCard(surface.root, 1, 0)).rejects.toThrow(
      'Combine drag did not reach the target card',
    );

    await expect(surface.root.getByText(GROUP_BADGE_TEXT)).not.toBeVisible();
    await expect(getRecipientStepCards(surface.root)).toHaveCount(2);

    await expectRecipientOrders(surface, [
      ['alice@example.com', 1],
      ['bob@example.com', 2],
    ]);
  });

  test('csc: dropping a recipient row onto a card does not join the group', async ({ page }) => {
    await forceCscClientMode(page);

    const surface = await openDocumentEnvelopeEditor(page);

    await makeEnvelopeSequential(surface);
    await setupTwoSequentialSigners(surface);

    const sweep = await sweepRecipientRowOverCard(surface.root, 1, 0);

    // The gap zones activating proves the drag itself was live, so the card
    // staying inactive is a real refusal rather than a failed gesture.
    expect(sweep.sawGapActive).toBe(true);
    expect(sweep.sawCardActive).toBe(false);
    expect(sweep.dropped).toBe(false);

    await expect(surface.root.getByText(GROUP_BADGE_TEXT)).not.toBeVisible();
    await expect(getRecipientStepCards(surface.root)).toHaveCount(2);

    await expectRecipientOrders(surface, [
      ['alice@example.com', 1],
      ['bob@example.com', 2],
    ]);
  });

  test('csc: step cards can still be reordered', async ({ page }) => {
    await forceCscClientMode(page);

    const surface = await openDocumentEnvelopeEditor(page);

    await makeEnvelopeSequential(surface);
    await setupTwoSequentialSigners(surface);

    await moveGroupCardUp(surface.root, 1);

    await expect(getRecipientEmailInputs(surface.root).nth(0)).toHaveValue('bob@example.com');
    await expect(getRecipientEmailInputs(surface.root).nth(1)).toHaveValue('alice@example.com');

    await expectRecipientOrders(surface, [
      ['alice@example.com', 2],
      ['bob@example.com', 1],
    ]);
  });

  test('csc: an existing group can still be ungrouped', async ({ page }) => {
    await forceCscClientMode(page);

    const surface = await openDocumentEnvelopeEditor(page);

    if (!surface.envelopeId) {
      throw new Error('Expected surface to have an envelope ID');
    }

    // A signing group can only exist on a CSC envelope through out-of-band
    // writes (API-created state); ungrouping must stay available to repair it.
    await prisma.recipient.createMany({
      data: [
        {
          envelopeId: surface.envelopeId,
          email: 'alice@example.com',
          name: 'Alice',
          token: nanoid(),
          signingOrder: 1,
        },
        {
          envelopeId: surface.envelopeId,
          email: 'bob@example.com',
          name: 'Bob',
          token: nanoid(),
          signingOrder: 1,
        },
      ],
    });

    await makeEnvelopeSequential(surface);

    await expect(surface.root.getByText(GROUP_BADGE_TEXT)).toBeVisible();

    const ungroupButton = surface.root.getByTestId('ungroup-step-button');

    await expect(ungroupButton).toBeEnabled();
    await ungroupButton.click();

    await expect(surface.root.getByText(GROUP_BADGE_TEXT)).not.toBeVisible();

    await expectRecipientOrders(surface, [
      ['alice@example.com', 1],
      ['bob@example.com', 2],
    ]);
  });
});

test.describe('document editor (non-csc control)', () => {
  // Control test proving `dragRecipientRowOntoCard` performs a real join when
  // grouping is available — without it the disabled-join test above could
  // pass vacuously because the drag itself silently failed.
  test('control: dropping a recipient row onto a card joins the group', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { root } = surface;

    await setRecipientEmail(root, 0, 'alice@example.com');

    await clickAddSignerButton(root);
    await setRecipientEmail(root, 1, 'bob@example.com');

    await toggleSigningOrder(root, true);
    await expect(getRecipientStepCards(root)).toHaveCount(2);

    // The mouse-driven join drag is timing-sensitive under load, so retry the
    // whole gesture until the group forms; a cancelled sweep leaves the order
    // untouched, and a completed drop joins the two rows into one step.
    await expect(async () => {
      const sweep = await sweepRecipientRowOverCard(root, 1, 0);

      expect(sweep.dropped).toBe(true);

      await expect(root.getByText(GROUP_BADGE_TEXT)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 90_000 });

    await expectRecipientOrders(surface, [
      ['alice@example.com', 1],
      ['bob@example.com', 1],
    ]);
  });
});
