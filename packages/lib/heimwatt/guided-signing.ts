/**
 * heimWatt fork addition — see HEIMWATT.md at the repository root.
 *
 * Pure step logic for the guided mobile signing bar
 * (`apps/remix/app/components/embed/heimwatt/guided-signing-bar.tsx`).
 *
 * Kept free of React and DOM so it can be unit-tested here and so an upstream
 * merge never touches it: nothing in this file imports from Documenso code.
 */

export type GuidedSigningInput = {
  /** The recipient has at least one signature-type field on the document. */
  hasSignatureField: boolean;
  /** A signature has been drawn/typed in the signing provider (not yet inserted anywhere). */
  hasSignature: boolean;
  /** Number of required fields that belong to this recipient. */
  requiredFieldCount: number;
  /** Number of those required fields that are still not inserted. */
  pendingFieldCount: number;
};

export type GuidedSigningStep =
  /** Step 1 — the customer has to draw their signature once. */
  | { kind: 'draw' }
  /** Step 2 — tap the next marked field; `index` is 1-based ("field 3 of 8"). */
  | { kind: 'field'; index: number; total: number }
  /** Step 3 — every required field is inserted; only "Complete" is left. */
  | { kind: 'complete'; total: number };

export const GUIDED_SIGNING_STEP_NUMBER: Record<GuidedSigningStep['kind'], 1 | 2 | 3> = {
  draw: 1,
  field: 2,
  complete: 3,
};

/**
 * Map the signing state to one of the three guided steps.
 *
 * The order is deliberate: a missing signature always comes first, because
 * Documenso inserts the stored signature into a field on tap — without a
 * signature, tapping a field would open the pad instead, which is exactly the
 * detour the guided bar is meant to remove.
 */
export const deriveGuidedSigningStep = (input: GuidedSigningInput): GuidedSigningStep => {
  const { hasSignatureField, hasSignature, requiredFieldCount, pendingFieldCount } = input;

  if (hasSignatureField && !hasSignature) {
    return { kind: 'draw' };
  }

  const total = Math.max(0, requiredFieldCount);
  const pending = Math.min(Math.max(0, pendingFieldCount), total);

  if (pending > 0) {
    return { kind: 'field', index: total - pending + 1, total };
  }

  return { kind: 'complete', total };
};

export type GuidedSigningEligibilityInput = {
  /** Runtime switch `NEXT_PUBLIC_HEIMWATT_GUIDED_SIGNING` (string from env). */
  featureFlag: string | undefined;
  /** Assistants fill fields for others and need the signer picker — not guided. */
  isAssistantMode: boolean;
  /** Name and e-mail are locked by the embedding app, so the widget form has nothing left to edit. */
  isNameLocked: boolean;
  isEmailLocked: boolean;
};

/**
 * Whether the guided bar may replace Documenso's collapsible mobile widget.
 *
 * Everything else falls back to upstream behaviour untouched — that is what
 * keeps the fork safe: the flag off, or any state the bar does not model,
 * renders exactly what Documenso ships.
 */
export const isGuidedSigningEligible = (input: GuidedSigningEligibilityInput): boolean => {
  return input.featureFlag === 'true' && !input.isAssistantMode && input.isNameLocked && input.isEmailLocked;
};
