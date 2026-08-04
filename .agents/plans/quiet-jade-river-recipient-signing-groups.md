---
date: 2026-08-04
title: Recipient Signing Groups
---

## Summary

Allow recipients to be **grouped into a single signing step** when "Enable signing order" (SEQUENTIAL) is on. Grouped recipients share the same `signingOrder` number and may act **in any order among themselves**; the next step only unlocks once **every** member of the group has completed their required action.

- A **step** = all non-CC recipients sharing one `signingOrder` value.
- A **group** = a step with 2+ members.
- Feature surface: **V2 envelope editor only** (`apps/remix/app/components/general/envelope-editor/envelope-editor-recipient-form.tsx`). Backend enforcement is global (any document with duplicate orders behaves correctly, including API-created ones).

No database schema changes: `Recipient.signingOrder` is already a nullable, non-unique `Int` (`packages/prisma/schema.prisma:647`), and all tRPC/REST schemas already accept duplicate values (`z.number().optional()` everywhere). Today duplicates are only destroyed by client-side normalization.

## Amendments (2026-08-04, post-implementation)

- The step badge copy is **"Group N"** (not "Step N").
- The signing-order number input was **removed entirely** — grouping, joining,
  extraction and reordering are **drag-and-drop only**. The "type-to-join" and
  "out-of-bounds number extraction" decisions below are superseded; the
  `Ungroup` link remains as the non-drag affordance for dissolving a group.
- Known limitation: gap drop-zones keep a constant hit area (drop-target
  geometry is captured at drag start, so drag-dependent resizing would
  desynchronise the visible strip from the actual hit area).

## Product decisions (agreed)

| Topic | Decision |
| --- | --- |
| Group representation | Derived from duplicate `signingOrder` values. No new tables/columns. |
| Whole-group drag | Required. Step cards are draggable as a unit (nested Kanban DnD). |
| Grouping gestures | Drag a recipient/step onto a card (combine) **or** type an existing step number into the order input (type-to-join, DocuSign style). |
| Removing one member | Drag the member row out to a gap zone, **or** type an out-of-bounds number (> step count) to become a standalone step at the end. |
| Ungroup link | Dissolves the whole group into consecutive standalone steps, preserving relative order. |
| Dictate next signer | Coexists with groups. Dictation UI/rewrite applies **only** when the completing signer is the last unsigned member of their step **and** the next step has exactly one member. Otherwise dictation is silently skipped for that transition. |
| Assistants | May be grouped. A grouped assistant can only assist recipients in **strictly higher** steps (never group peers). |
| CSC/TSP (AES/QES) instances | Groups are blocked (editor validation). TSP signing path unchanged. |
| V1 editors | Unchanged. Editing recipients of a grouped document in a V1 surface flattens groups (accepted limitation). |

## Current-state reference

Key decision points that assume a single "next recipient":

- `packages/lib/server-only/document/send-document.ts:150-157` — SEQUENTIAL initial send notifies `.slice(0, 1)` of pending recipients.
- `packages/lib/server-only/document/complete-document-with-token.ts:368-459` — after completion, `const [nextRecipient] = pendingRecipients` is activated (sendStatus SENT) and emailed; dictation rewrites that single recipient.
- `packages/lib/server-only/recipient/get-is-recipient-turn.ts:40-49` — **index-based** loop: everyone earlier in the sorted array must be SIGNED. Two recipients sharing an order would block each other.
- `packages/lib/server-only/envelope/get-envelope-for-recipient-signing.ts:263-279` — duplicated inline copy of the same index-based loop (feeds V2 signing `isRecipientsTurn`).
- `packages/lib/server-only/recipient/get-next-pending-recipient.ts` — returns `recipients[currentIndex + 1]` for the dictate-next-signer form (V1 sign loader).
- `packages/lib/server-only/template/create-document-from-direct-template.ts:674-742` — same single-next assumption for direct-template dictation.
- Assistant scope: `packages/lib/server-only/recipient/get-recipients-for-assistant.ts` and the assistant branch of `packages/trpc/server/envelope-router/sign-envelope-field.ts` use `signingOrder: { gte: ... }`.
- Client normalization: `normalizeRecipientSigningOrders` (`packages/lib/utils/recipients.ts:50-68`) force-renumbers non-CC recipients `index + 1`, destroying duplicates. Used by V2 editor (via `packages/lib/client-only/hooks/use-editor-recipients.ts`) and V1 editors.
- Editor autosave: watch-effect in `envelope-editor-recipient-form.tsx:524-588` diffs signers (incl. `signingOrder`) and calls `setRecipientsDebounced` → `trpc.envelope.recipient.set` (1000 ms debounce); meta changes go through `envelope.update`.
- The canonical sort everywhere: `orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }]`.

## 1. Data model & ordering semantics

- Orders stay dense `1..K` (K = number of steps): a grouped document looks like `[1, 2, 3, 3, 4]`.
- CC recipients keep `signingOrder: undefined` and always sort after steps (unchanged).
- REJECTED semantics unchanged: turn checks treat `signingStatus !== SIGNED` (including REJECTED) as blocking; rejection independently cancels the document via the existing flow.
- Null orders (legacy/API data) sort last (treated as `+Infinity` in comparisons).

## 2. Shared pure utilities — `packages/lib/utils/recipient-groups.ts` (new)

Client-safe pure functions, fully unit-tested:

- `groupRecipientsBySigningOrder(signers)` → `{ steps: Array<{ order: number; members: T[] }>, ccRecipients: T[] }`. Steps sorted ascending; members keep array order.
- `normalizeGroupedSigningOrders(signers, canUpdate?)` → dense-renumbers steps **preserving duplicates**. Contract mirrors the flat normalizer: steps sort by current order and are renumbered by sequence position; a step containing a locked recipient (per `canUpdate`) keeps the locked member's persisted order; editable steps never collide into a locked step's number (no accidental grouping — they take the next free position). In practice locked recipients occupy a prefix of the sequence (sequential signing means earlier steps signed first), so positions and persisted orders agree; API-created oddities degrade gracefully like today. CC recipients get `undefined` and move to the tail.
- Editor operations (each returns a new, normalized signers array; no mutation):
  - `reorderStep(signers, fromStepIndex, toStepIndex)`
  - `mergeSteps(signers, sourceStepIndex, targetStepIndex)` — all source members adopt the target step's order
  - `moveRecipientToStep(signers, formId, targetStepIndex)` — join a group
  - `extractRecipientToNewStep(signers, formId, insertStepIndex)` — become a standalone step at that gap position
  - `ungroupStep(signers, stepIndex)` — members become consecutive standalone steps
- `getDictatableNextRecipient(recipients, currentRecipientId)` → the single next-step recipient, or `null` when the current signer isn't the last unsigned member of their step or the next step has ≠ 1 member. Shared by server dictation logic and client dictate-form mirrors.

`normalizeRecipientSigningOrders` (flat) is left untouched for V1 surfaces. `isAssistantLastSigner` (`packages/lib/utils/recipients.ts:25-30`) becomes group-aware: warns when any ASSISTANT sits in the **last step** (equivalent behavior for ungrouped documents).

## 3. Editor UI — structure & visuals

Component split under `apps/remix/app/components/general/envelope-editor/`:

- `envelope-editor-recipient-form.tsx` — retains header actions (AI detect, Add Myself, Add Signer), signing-order/dictate checkboxes, autosave watch-effect (unchanged logic), dialogs, limits alert.
- `recipient-step-list.tsx` (new) — `DragDropContext`, outer step `Droppable`, gap drop-zones, step derivation via `groupRecipientsBySigningOrder(watchedSigners)`.
- `recipient-step-card.tsx` (new) — card chrome: card-level grip, `Step {n}` badge (`Badge variant="neutral"`), group header row (`Users2Icon` + `{n} signers · any order` via `plural()` + right-aligned `Ungroup` link `Button variant="link"`), inner member `Droppable`.
- `recipient-row.tsx` (new) — moved row internals: row grip, order input, email/name `RecipientAutoCompleteInput`, `RecipientRoleSelect`, delete button, advanced `RecipientActionAuthSelect`.

Rendering rules:

- Form state remains the single flat `signers` field array (react-hook-form indices = flat array positions); steps are derived at render time only.
- Sequential mode: every step renders as a bordered card. Group cards (2+ members) get the green accent treatment: `border-primary`-tinted border, light green background, green-tinted order inputs, group header row visible.
- Single-member steps: card with `Step {n}` badge, card grip, and the member row (with its own row grip) — no group header.
- CC recipients: plain non-draggable cards without badge/order input, rendered after the last step.
- Parallel mode (signing order off): render today's flat rows — no cards, badges, or grouping UI.
- All new strings use `<Trans>`/`t`/`plural` macros.

## 4. Editor UI — interactions

### Drag & drop (nested Kanban, `@hello-pangea/dnd`)

- Outer `Droppable` `type="STEP"` (vertical) contains one `Draggable` per step; drag handle = card grip. `isCombineEnabled` on.
- Each step card contains an inner `Droppable` `type="RECIPIENT"` with one `Draggable` per member; drag handle = row grip.
- Gap zones: slim `Droppable`s of `type="RECIPIENT"` rendered between cards and at both ends. Collapsed (`h-2`, invisible) normally; while a RECIPIENT drag is active (tracked via `onBeforeCapture`), they expand to dashed strips (per mock image 2).

| Gesture | DnD result | Operation |
| --- | --- | --- |
| Card grip → drop between cards | `type=STEP`, `destination` | `reorderStep` |
| Card grip → drop onto another card's center | `type=STEP`, `combine` | `mergeSteps` |
| Row grip → drop onto another step card | `type=RECIPIENT`, destination = that card's inner droppable | `moveRecipientToStep` |
| Row grip → drop on a gap zone | `type=RECIPIENT`, destination = gap droppable | `extractRecipientToNewStep` |
| Row grip → drop within own step | destination = own inner droppable | no-op |

Hover affordances: target card shows a green ring + floating `Release to sign together` badge (with users icon) when it is a combine target (`snapshot.combineTargetFor`) **or** an inner-droppable hover target (`snapshot.isDraggingOver`). Existing drag styling (widget background, pointer-events) carries over.

After every operation: normalize → `form.setValue('signers', ...)` (validate + dirty) → assistant-last-step warning toast when applicable → `form.trigger('signers')`. The existing watch-effect autosaves.

### Signing-order number input

- `min=1`, `max=stepCount + 1` (spinner + typed, `data-testid="signing-order-input"` kept).
- Value `N` where `N` = own step → no-op.
- `N` in `1..K`, other step → `moveRecipientToStep` (type-to-join; also merges two solo steps into a group).
- `N > K` → `extractRecipientToNewStep` at the end (out-of-bounds extraction).
- Invalid input (empty, non-integer, `< 1`) → ignored (current behavior).

### Other interactions

- **Ungroup** link → `ungroupStep`.
- **Add Signer / Add Myself / AI detection** → new standalone step at the end (`signingOrder = stepCount + 1`).
- **Remove signer** → existing flow + group-aware normalize (a group of 2 losing a member dissolves into a plain step; empty steps disappear).
- **Role change to CC** → member leaves its step (normalize moves it to the tail). Role change to ASSISTANT inside a group is allowed.
- **Locked recipients** (signed or inserted fields, per `canRecipientBeModified`): row controls disabled as today. A step containing a locked member cannot have its order changed — card grip disabled (no drag/reorder, no combining it *into* another step) and Ungroup disabled. It **may** still receive new members (inner drop, combine-as-target, type-to-join), since that never alters the locked member's order; editable peers may still be dragged out individually.
- **Drag disabled** entirely when: parallel mode, submitting, or (per draggable) CC/locked — matching current `isDragDisabled` rules.

## 5. Backend signing flow (group-aware)

Single shared predicate (pure, in `recipient-groups.ts`): *a recipient may act iff no non-CC recipient with `signingStatus !== SIGNED` has a strictly lower `signingOrder` (null = ∞)*.

1. **Turn check** — `get-is-recipient-turn.ts` replaces its index loop with the predicate; `get-envelope-for-recipient-signing.ts:263-279` deletes its inline copy and calls the same helper. Both keep their existing queries (add the `nulls: 'last'` + `id` tiebreaker to the sort in both for consistency).
2. **Initial send** — `send-document.ts`: SEQUENTIAL now notifies **all** pending non-CC recipients holding the minimum pending order (replaces `.slice(0, 1)`).
3. **Completion advance** — `complete-document-with-token.ts`: compute `nextGroup` = pending (non-SIGNED, non-CC) recipients at the minimum order. Activate (sendStatus SENT + sentAt) and email **only members with `sendStatus !== SENT`**, each via the existing `send.signing.requested.email` job. This one rule covers both cases: mid-group completion (remaining peers already SENT → nothing sent, no advance) and step transition (all next-step members activated together). The "waiting for others" pending email to the just-signed recipient is unchanged. Mirror the same logic in `create-document-from-direct-template.ts`.
4. **Dictate next signer** — rewrite (`nextSigner` name/email + RECIPIENT_UPDATED audit log) applies only when `allowDictateNextSigner && nextGroup.length === 1` and that member is freshly activated (`sendStatus !== SENT`). Server form source `get-next-pending-recipient.ts` and the client mirrors (`envelope-signing-provider.tsx`, `document-signing-page-view-v1.tsx`, `direct-template-signing-form.tsx`) all switch to `getDictatableNextRecipient` — the form only renders when the completing signer is the last unsigned member of their step and the next step has exactly one member.
5. **Assistants** — `get-recipients-for-assistant.ts` and the assistant branch of `sign-envelope-field.ts` change `gte` → strictly-greater semantics so grouped assistants cannot act for group peers. Implementation must verify whether the current `gte` lists include the assistant themself and preserve that self-inclusion explicitly (`OR id = assistant.id`) if so.
6. **CSC/TSP** — no changes to `execute-tsp-sign.ts` (head-of-queue advance stays safe even if duplicates arrive via API). The editor blocks group creation on CSC instances via the existing CSC `superRefine` in `ZEditorRecipientsFormSchema`: add an issue when any non-CC duplicate `signingOrder` exists.

No email template, webhook, audit-log, or job-definition changes: activation emails, events, and logs are already per-recipient.

## 6. Validation & compatibility

- `ZEditorRecipientsFormSchema` gains the CSC no-duplicates issue only; tRPC/REST schemas stay `z.number().optional()` (duplicates are now legitimate).
- Templates: groups carry into created documents (`signingOrder` copies verbatim in template → document creation and document duplication). Verified by unit/E2E coverage.
- V1 editors and embed authoring keep the flat normalizer: opening & saving recipients there flattens groups into consecutive steps (accepted, documented limitation).
- API consumers that already send duplicate orders gain correct parallel-group behavior automatically.

## 7. Testing

**Unit (vitest, `packages/lib`)** — new `recipient-groups.test.ts` (+ extend `recipients.test.ts`):

- Step derivation (duplicates, nulls, CC exclusion, stable member order).
- `normalizeGroupedSigningOrders`: preserves groups, compacts gaps, locked-recipient anchoring, CC tail.
- Each editor operation: merge, join, extract (incl. out-of-bounds), reorder, ungroup, dissolve-on-removal.
- Turn predicate: group member allowed when lower steps signed; blocked by any lower unsigned/REJECTED; parallel mode; null orders; single-member equivalence with old behavior.
- `getDictatableNextRecipient`: eligibility matrix (mid-group vs last-of-group × next step size 1/2+/none).

**E2E (Playwright, `packages/app-tests`, per the envelope-editor-v2-e2e skill)**:

- Editor: type-to-join creates a group (badge `Step 3`, header `2 signers · any order`, green styling), persistence after reload, Ungroup restores sequential steps, out-of-bounds extraction.
- Signing flow: document `[1, (2,2), 3]` — after step 1 signs, both group members can access signing (either order); step 3 is blocked (waiting page) until both complete, then unlocks; activation emails fire once per member.
- One best-effort drag smoke test (combine two solo steps); drag logic correctness is otherwise covered by unit tests.

## 8. Out of scope

- Named groups, quorum ("k of n") semantics, or per-group metadata (would require an explicit group entity — future migration if ever needed).
- Whole-group drag *into* another group via card grip is a merge (`mergeSteps`); there is no "insert group inside group" concept.
- V1 editor group awareness.
- TSP/CSC parallel signing.
