/**
 * heimWatt fork addition — see HEIMWATT.md at the repository root.
 *
 * WHY
 *   Customers signing on a phone did not find the signature fields: Documenso's
 *   mobile widget is a collapsed "Sign document" header with a chevron, and the
 *   fields live somewhere further down in the document. Many never tapped
 *   either. This bar replaces that widget on small screens (< md) with three
 *   guided steps and ONE primary action:
 *
 *     1 "draw"     — no signature yet      → button opens the signature pad
 *     2 "field"    — fields still pending  → button scrolls to the next field
 *                                            ("field x of n"), and after each
 *                                            insert the bar advances by itself
 *     3 "complete" — everything inserted   → button completes the document
 *
 *   Desktop (md+) keeps the upstream widget untouched.
 *
 * HOW IT HOOKS IN (the only places upstream code is touched)
 *   - `embed-document-signing-page-v1.tsx`: one `// heimWatt:` block renders
 *     this bar and hides the upstream widget below md while the bar is active.
 *   - `signature-pad-dialog.tsx`: optional `open`/`onOpenChange`/`hideTrigger`
 *     props so the bar can open the pad from its own button.
 *   - Step logic is pure and unit-tested in
 *     `packages/lib/heimwatt/guided-signing.ts`.
 *
 * SWITCHING IT OFF
 *   Env `NEXT_PUBLIC_HEIMWATT_GUIDED_SIGNING` (runtime, read from
 *   `window.__ENV__`): anything but "true" renders pure upstream. Removing the
 *   feature entirely = delete the `heimwatt/` folders, revert the two
 *   `// heimWatt:` hunks, drop the env var.
 */
import { GUIDED_SIGNING_STEP_NUMBER, type GuidedSigningStep } from '@documenso/lib/heimwatt/guided-signing';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { SignaturePadDialog } from '@documenso/ui/primitives/signature-pad/signature-pad-dialog';
import { Trans, useLingui } from '@lingui/react/macro';
import type { DocumentMeta } from '@prisma/client';
import { ArrowDown, Check, PenLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type GuidedSigningBarProps = {
  step: GuidedSigningStep;
  /** Scrolls to and highlights the next pending field (upstream `onNextFieldClick`). */
  onNextField: () => void;
  /** Completes the document (upstream `throttledOnCompleteClick`). */
  onComplete: () => void;
  isCompleting: boolean;
  completeDisabled: boolean;
  /** Signature pad wiring — identical to the upstream widget's `SignaturePadDialog`. */
  fullName: string;
  signature: string;
  onSignatureChange: (signature: string) => void;
  metadata?: DocumentMeta | null;
};

/** Tailwind `md` breakpoint — the bar only exists below it. */
const BELOW_MD_QUERY = '(max-width: 767.98px)';

const useIsBelowMd = () => {
  const [isBelowMd, setIsBelowMd] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(BELOW_MD_QUERY);

    const update = () => setIsBelowMd(mediaQuery.matches);

    update();
    mediaQuery.addEventListener('change', update);

    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isBelowMd;
};

export const GuidedSigningBar = ({
  step,
  onNextField,
  onComplete,
  isCompleting,
  completeDisabled,
  fullName,
  signature,
  onSignatureChange,
  metadata,
}: GuidedSigningBarProps) => {
  const isBelowMd = useIsBelowMd();
  const [isPadOpen, setIsPadOpen] = useState(false);

  const stepNumber = GUIDED_SIGNING_STEP_NUMBER[step.kind];

  // Auto-advance: whenever the step moves forward into (or within) step 2 —
  // signature just drawn, or a field just inserted — scroll to the next field
  // so the customer never has to hunt for it. Deliberately not on first
  // render (no jump on load) and not on desktop (upstream behaviour there).
  const previousStepKey = useRef<string | null>(null);

  useEffect(() => {
    const stepKey = step.kind === 'field' ? `field:${step.index}` : step.kind;
    const previous = previousStepKey.current;

    previousStepKey.current = stepKey;

    if (previous === null || previous === stepKey || step.kind !== 'field' || !isBelowMd) {
      return;
    }

    onNextField();
    // `onNextField` is recreated on every render of the page; the step key is
    // the intended trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isBelowMd]);

  return (
    <>
      <div className="embed--GuidedSigningBar fixed bottom-4 left-0 z-50 w-full px-4 md:hidden">
        <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-widget p-3 pl-3.5 shadow-lg">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <StepDots current={stepNumber} />

            <div className="flex flex-col gap-0.5">
              <p className="truncate font-semibold text-foreground text-sm leading-tight">
                {step.kind === 'draw' && <Trans>Create your signature</Trans>}
                {step.kind === 'field' && (
                  <Trans>
                    Tap field {step.index} of {step.total}
                  </Trans>
                )}
                {step.kind === 'complete' && <Trans>All {step.total} fields set</Trans>}
              </p>

              <p className="truncate text-muted-foreground text-xs">
                {step.kind === 'draw' && <Trans>Draw it once with your finger</Trans>}
                {step.kind === 'field' && <Trans>Tap the highlighted field in the document</Trans>}
                {step.kind === 'complete' && <Trans>Finish to sign bindingly</Trans>}
              </p>
            </div>
          </div>

          {step.kind === 'draw' && (
            <Button type="button" className="shrink-0" onClick={() => setIsPadOpen(true)}>
              <PenLine className="mr-2 h-4 w-4" />
              <Trans context="Draw signature">Draw</Trans>
            </Button>
          )}

          {step.kind === 'field' && (
            <Button type="button" className="shrink-0" onClick={() => onNextField()}>
              <ArrowDown className="mr-2 h-4 w-4" />
              <Trans>Go to field</Trans>
            </Button>
          )}

          {step.kind === 'complete' && (
            <Button
              type="button"
              className="shrink-0 bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={completeDisabled}
              loading={isCompleting}
              onClick={() => onComplete()}
            >
              {!isCompleting && <Check className="mr-2 h-4 w-4" />}
              <Trans>Complete</Trans>
            </Button>
          )}
        </div>
      </div>

      <SignaturePadDialog
        hideTrigger
        open={isPadOpen}
        onOpenChange={setIsPadOpen}
        disableAnimation
        fullName={fullName}
        value={signature}
        onChange={(value) => onSignatureChange(value ?? '')}
        typedSignatureEnabled={metadata?.typedSignatureEnabled}
        uploadSignatureEnabled={metadata?.uploadSignatureEnabled}
        drawSignatureEnabled={metadata?.drawSignatureEnabled}
      />
    </>
  );
};

const STEPS = [1, 2, 3] as const;

/** 1 · 2 · 3 — done steps green with a check, the current one in primary. */
const StepDots = ({ current }: { current: 1 | 2 | 3 }) => {
  const { t } = useLingui();

  return (
    <ol className="flex items-center" aria-label={t`Signing progress`}>
      {STEPS.map((n) => {
        const isDone = n < current;
        const isCurrent = n === current;

        return (
          <li key={n} className="flex items-center" aria-current={isCurrent ? 'step' : undefined}>
            <span
              className={cn(
                'inline-flex h-5 w-5 items-center justify-center rounded-full border font-bold text-[11px] leading-none',
                isDone && 'border-transparent bg-accent text-accent-foreground',
                isCurrent && 'border-transparent bg-primary text-primary-foreground',
                !isDone && !isCurrent && 'border-border text-muted-foreground',
              )}
            >
              {isDone ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : n}
            </span>

            {n < 3 && <span className={cn('h-px w-2.5', isDone ? 'bg-accent' : 'bg-border')} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
};
