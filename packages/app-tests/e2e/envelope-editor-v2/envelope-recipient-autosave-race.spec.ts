import { prisma } from '@documenso/prisma';
import { expect, type Page, test } from '@playwright/test';

import {
  clickAddSignerButton,
  clickEnvelopeEditorStep,
  getRecipientEmailInputs,
  openDocumentEnvelopeEditor,
  setRecipientEmail,
  setRecipientName,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';

/**
 * Reproduction for the recipient autosave race condition.
 *
 * Symptom (production only, where there is real network lag):
 *   1. The author adds a recipient and types its name/email.
 *   2. They navigate to the "Add Fields" step.
 *   3. The recipient selector shows the default "Recipient 1" placeholder
 *      instead of the recipient they just typed, and the typed name/email is
 *      silently lost.
 *
 * Theory (see packages/lib/client-only/hooks/use-envelope-autosave.ts):
 *   When the author navigates, `flushAutosave()` is awaited before the Add
 *   Fields page renders. If an *earlier* (empty) recipient save is still
 *   in-flight at that moment, `flush()` awaits that in-flight save and returns
 *   WITHOUT committing the newer typed data sitting in `lastArgsRef` (whose
 *   debounce timer it just cleared). The typed data is dropped, the empty
 *   recipient persists, and the selector renders "Recipient 1".
 *
 * This only happens when a save is still in-flight at navigation time, which is
 * why it never reproduces locally (fast saves) but does on a laggy network.
 *
 * The test below simulates that lag by holding the first `envelope.recipient.set`
 * request open. It asserts the CORRECT behaviour (typed recipient survives), so
 * it is RED while the bug exists and GREEN once the autosave hook is fixed.
 */

const RECIPIENT_SET_PROCEDURE = 'envelope.recipient.set';

// How long to hold the first recipient autosave "in-flight" to emulate prod lag.
const SIMULATED_NETWORK_LAG_MS = 5000;

const FIRST_RECIPIENT = {
  name: 'Alice Author',
  email: 'alice-autosave-race@example.com',
};

const SECOND_RECIPIENT = {
  name: 'Bob Builder',
  email: 'bob-autosave-race@example.com',
};

type RecipientSetLagHandle = {
  /** Resolves the instant the first recipient.set request is in-flight on the client. */
  firstRecipientSetInFlight: Promise<void>;
  /** Raw request bodies of every recipient.set call we intercepted. */
  recipientSetRequestBodies: string[];
};

/**
 * Installs a fake "production network lag" on the recipient autosave mutation.
 *
 * Only the FIRST recipient.set request is held open for `lagMs` (this is the save
 * that must still be in-flight at navigation time for the race to occur). It
 * resolves `firstRecipientSetInFlight` the instant it is intercepted so the test
 * can keep typing while that save is pending. Subsequent recipient.set requests
 * (e.g. the follow-up save the fixed hook issues) are forwarded immediately so the
 * test does not pay the lag twice.
 */
const installRecipientSetLag = async (page: Page, lagMs: number): Promise<RecipientSetLagHandle> => {
  let markFirstInFlight: () => void = () => {};

  const firstRecipientSetInFlight = new Promise<void>((resolve) => {
    markFirstInFlight = resolve;
  });

  const recipientSetRequestBodies: string[] = [];

  await page.route('**/api/trpc/**', async (route) => {
    const request = route.request();

    if (request.method() !== 'POST' || !request.url().includes(RECIPIENT_SET_PROCEDURE)) {
      await route.continue();
      return;
    }

    const callIndex = recipientSetRequestBodies.length + 1;
    recipientSetRequestBodies.push(request.postData() ?? '');

    if (callIndex === 1) {
      // eslint-disable-next-line no-console
      console.log(`[test] holding first ${RECIPIENT_SET_PROCEDURE} for ${lagMs}ms (simulated network lag)`);

      // The empty save is now in-flight from the client's perspective.
      markFirstInFlight();

      await new Promise((resolve) => setTimeout(resolve, lagMs));
    } else {
      // eslint-disable-next-line no-console
      console.log(`[test] forwarding ${RECIPIENT_SET_PROCEDURE} #${callIndex} (no lag)`);
    }

    await route.continue();
  });

  return { firstRecipientSetInFlight, recipientSetRequestBodies };
};

const assertEnvelopeRecipientsPersisted = async (surface: TEnvelopeEditorSurface) => {
  if (!surface.envelopeId) {
    throw new Error('Expected the document editor surface to have an envelopeId');
  }

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: surface.envelopeId },
    include: {
      recipients: {
        orderBy: { signingOrder: 'asc' },
      },
    },
  });

  const persistedEmails = envelope.recipients.map((recipient) => recipient.email).filter(Boolean);

  // eslint-disable-next-line no-console
  console.log(
    '[test] persisted recipients:',
    JSON.stringify(
      envelope.recipients.map((recipient) => ({ name: recipient.name, email: recipient.email })),
      null,
      2,
    ),
  );

  expect(persistedEmails).toContain(FIRST_RECIPIENT.email);
  expect(persistedEmails).toContain(SECOND_RECIPIENT.email);
};

test.describe('envelope editor recipient autosave race (network lag)', () => {
  test('document editor: typed recipient survives navigation to Add Fields', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    const { firstRecipientSetInFlight, recipientSetRequestBodies } = await installRecipientSetLag(
      page,
      SIMULATED_NETWORK_LAG_MS,
    );

    // 1. Add a second signer row. A blank document already has one empty default
    //    signer, so this schedules an autosave of TWO empty recipients
    //    (name='' / email='') - this is the save that will be in-flight.
    await clickAddSignerButton(surface.root);
    await expect(getRecipientEmailInputs(surface.root)).toHaveCount(2);

    // 2. Wait until that empty autosave is actually in-flight on the client. This
    //    is the precondition the bug needs: a slow save holding the autosave lock.
    await firstRecipientSetInFlight;

    // 3. The author now fills in the recipients they are adding.
    await setRecipientName(surface.root, 0, FIRST_RECIPIENT.name);
    await setRecipientEmail(surface.root, 0, FIRST_RECIPIENT.email);
    await setRecipientName(surface.root, 1, SECOND_RECIPIENT.name);
    await setRecipientEmail(surface.root, 1, SECOND_RECIPIENT.email);

    // 4. Immediately navigate to Add Fields (before the typed data's debounce
    //    fires). flushAutosave() awaits the in-flight EMPTY save; with the bug
    //    present it returns without ever committing the typed data.
    await clickEnvelopeEditorStep(surface.root, 'addFields');

    // 5. Wait for the Add Fields page to render (after the lagged flush resolves).
    await expect(surface.root.getByText('Selected Recipient')).toBeVisible({
      timeout: SIMULATED_NETWORK_LAG_MS + 15000,
    });

    // Diagnostics - the request bodies show what actually reached the server.
    // Buggy: only the first (empty) save is ever sent. Fixed: a follow-up save
    // carrying the typed recipients is sent too.
    // eslint-disable-next-line no-console
    console.log('\n===== AUTOSAVE RACE DIAGNOSTICS =====');
    // eslint-disable-next-line no-console
    console.log(`recipient.set requests sent to server: ${recipientSetRequestBodies.length}`);
    // eslint-disable-next-line no-console
    console.log(
      `server ever received "${FIRST_RECIPIENT.email}": ${recipientSetRequestBodies.some((body) => body.includes(FIRST_RECIPIENT.email))}`,
    );
    // eslint-disable-next-line no-console
    console.log('=====================================\n');

    // 6. THE USER-VISIBLE BUG: the selected recipient must be the one we typed
    //    (Alice), not the default "Recipient 1" placeholder.
    const selectedRecipientSection = surface.root.locator('section').filter({ hasText: 'Selected Recipient' });

    await expect(selectedRecipientSection.getByRole('combobox')).toContainText(FIRST_RECIPIENT.name);

    // 7. THE DATA LOSS: the typed recipients must actually be persisted.
    await assertEnvelopeRecipientsPersisted(surface);
  });
});
