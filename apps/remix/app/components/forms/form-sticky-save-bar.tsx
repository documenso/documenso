import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Trans, useLingui } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangleIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type FormStickySaveBarProps = {
  isDirty: boolean;
  isSubmitting: boolean;
  onReset: () => void;
};

/**
 * A single `position: sticky` bar rendered at the bottom of the form.
 *
 * - When the form's end is on screen it settles into place as a plain footer (just the
 *   Reset / Save buttons).
 * - When the form's end is scrolled off, it sticks to the bottom of the viewport and
 *   shows the "unsaved changes" pill chrome.
 *
 * Because it's the same element in the form's flow, it auto-aligns to the form and the
 * float <-> dock hand-off is a native, scroll-linked transition (no measurement, no
 * shared-layout morph). A 1px sentinel below it detects the stuck state so we can toggle
 * the pill chrome.
 */
export const FormStickySaveBar = ({ isDirty, isSubmitting, onReset }: FormStickySaveBarProps) => {
  const { t } = useLingui();

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    // The sentinel sits at the bar's resting position (the end of the form). While the
    // bar is stuck to the bottom of the viewport the sentinel is scrolled past (out of
    // view); once you reach the form's end it comes into view and the bar settles.
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStuck(!entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: '0px 0px -24px 0px',
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Show the floating pill chrome only when there are unsaved changes AND the form's
  // end is off screen.
  const isFloating = isDirty && isStuck;

  return (
    <>
      <div
        data-testid="form-sticky-save-bar"
        className={cn(
          'z-40 flex min-h-9 min-w-0 items-center gap-x-2 rounded-lg py-4 transition-[margin,padding,background-color,border-color,box-shadow] duration-200 md:gap-x-4',
          isDirty ? 'sticky bottom-6' : '',
          // On mobile the docked and floating states are geometrically identical (only
          // paint changes): a horizontal bleed there overflows the narrow viewport and
          // fights the IntersectionObserver (oscillation + partial hiding). From `sm` up
          // there's room, so we restore the original chrome — the island bleeds 8px past
          // the form when floating, and the buttons sit flush with the fields when docked.
          isFloating
            ? 'border border-border bg-background px-4 shadow-2xl sm:-mx-2'
            : 'border border-transparent bg-transparent px-4 shadow-none sm:px-0',
        )}
      >
        <AnimatePresence initial={false}>
          {isFloating && (
            <motion.div
              key="notice"
              role="region"
              aria-label={t`Unsaved changes`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex min-h-9 min-w-0 items-center gap-x-2 text-sm"
            >
              <AlertTriangleIcon className="h-5 w-5 flex-shrink-0 text-destructive" />
              <span className="font-medium text-xs md:text-sm">
                <Trans>You have unsaved changes</Trans>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="ml-auto flex flex-shrink-0 items-center gap-x-2">
          {isDirty && (
            <Button type="button" variant="secondary" size="sm" onClick={onReset} disabled={isSubmitting}>
              <Trans>Undo</Trans>
            </Button>
          )}

          <Button type="submit" className="shrink-0" size="sm" loading={isSubmitting} disabled={!isDirty}>
            <Trans>Save changes</Trans>
          </Button>
        </div>
      </div>

      {/* Sentinel: detects when the sticky bar is floating (stuck) vs settled (docked). */}
      <div ref={sentinelRef} aria-hidden className="pointer-events-none h-px w-full" />
    </>
  );
};
