import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { Trans } from '@lingui/react/macro';
import { motion, useReducedMotion } from 'framer-motion';

import { EASE, POP, SPRING } from './motion';
import { SettingsUpsellCard } from './settings-upsell-card';
import { useTimedCycle } from './use-timed-cycle';

const DEMO_BRANDS = [
  {
    name: 'Documenso',
    letter: 'D',
    domain: 'noreply@app.documenso.com',
    accent: '#A2E771',
    ink: '#162C07',
    tint: '#F2FBEA',
    sheen: 'rgba(162, 231, 113, 0.32)',
  },
  {
    name: 'Documenso',
    letter: 'D',
    domain: 'noreply@app.documenso.com',
    accent: '#387BC7',
    ink: '#ffffff',
    tint: '#EDF3FA',
    sheen: 'rgba(56, 123, 199, 0.28)',
  },
  {
    name: 'Documenso',
    letter: 'D',
    domain: 'noreply@app.documenso.com',
    accent: '#9747F5',
    ink: '#ffffff',
    tint: '#F4EDFE',
    sheen: 'rgba(151, 71, 245, 0.26)',
  },
];

/**
 * Milliseconds each brand is shown before cycling to the next.
 */
const BRAND_CYCLE_INTERVAL_MS = 2400;

export const BrandingUpsell = () => {
  const organisation = useCurrentOrganisation();

  const isReducedMotion = useReducedMotion();
  const brandIndex = useTimedCycle(DEMO_BRANDS.map(() => BRAND_CYCLE_INTERVAL_MS));

  const isStatic = isReducedMotion ?? false;

  const brand = DEMO_BRANDS[brandIndex];

  return (
    <SettingsUpsellCard
      planLabel={<Trans>Teams</Trans>}
      title={<Trans>Unlock Branding Preferences</Trans>}
      description={
        <Trans>Put your own brand on every document you send. Branding is available on the Teams plan and above.</Trans>
      }
      features={[
        <Trans key="logo">Your logo on signing pages and emails</Trans>,
        <Trans key="details">Company details and website in email footers</Trans>,
        <Trans key="teams">Separate branding per team</Trans>,
      ]}
      preview={
        <div className="mx-auto w-full max-w-xs">
          <div className="flex h-8 items-center justify-between px-1">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              <Trans>Brand accent</Trans>
            </span>

            <div className="flex shrink-0 items-center gap-2">
              {DEMO_BRANDS.map((dotBrand, index) => (
                <motion.div
                  key={index}
                  initial={isStatic ? false : undefined}
                  animate={{
                    scale: index === brandIndex ? 1.25 : 1,
                    opacity: index === brandIndex ? 1 : 0.42,
                    boxShadow:
                      index === brandIndex ? '0 0 0 3px rgba(15, 23, 42, 0.08)' : '0 0 0 0 rgba(15, 23, 42, 0)',
                  }}
                  transition={SPRING}
                  className="h-[13px] w-[13px] rounded-full"
                  style={{ backgroundColor: dotBrand.accent }}
                />
              ))}
            </div>
          </div>

          <div className="relative mt-3 flex flex-col overflow-hidden rounded-lg border bg-background shadow-sm">
            <motion.div
              initial={isStatic ? false : undefined}
              animate={{ backgroundColor: brand.tint }}
              transition={{ duration: 0.45, ease: EASE }}
              className="flex items-center gap-2.5 border-b px-4 py-3"
            >
              {/* The sender identity never changes — only the tile colours tween per brand. */}
              <motion.div
                initial={isStatic ? false : undefined}
                animate={{ backgroundColor: brand.accent, color: brand.ink }}
                transition={{ backgroundColor: { duration: 0.4 }, color: { duration: 0.4 } }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-semibold text-sm"
              >
                {brand.letter}
              </motion.div>

              {/*
               * Hardcoded inks (not theme tokens): this row sits on the
               * hardcoded light `tint` band, so it pairs with hardcoded ink
               * colours the same way the email sibling pairs its hardcoded
               * avatar surfaces (hardcoded surface => hardcoded ink).
               */}
              <div className="min-w-0">
                <div className="font-medium text-[#0f172a] text-sm">
                  <p className="truncate">{brand.name}</p>
                </div>

                <div className="font-mono text-[#64748b] text-xs">
                  <p className="truncate">{brand.domain}</p>
                </div>
              </div>
            </motion.div>

            <div className="px-4 py-3.5">
              <p className="font-medium text-sm">
                <Trans>Please sign: Example.pdf</Trans>
              </p>

              <p className="mt-1 text-muted-foreground text-xs">
                <Trans>{organisation.name} has invited you to sign this document.</Trans>
              </p>

              {/* Same replay split as the logo tile: colours tween on the persistent button, the pop replays per brand on the remounting label. */}
              <motion.div
                initial={isStatic ? false : undefined}
                animate={{ backgroundColor: brand.accent, color: brand.ink }}
                transition={{ backgroundColor: { duration: 0.4 }, color: { duration: 0.4 } }}
                className="mt-3 inline-block rounded-md px-3 py-1.5 font-medium text-xs"
              >
                <motion.span
                  key={brandIndex}
                  initial={isStatic ? false : { scale: 0.96 }}
                  animate={{ scale: 1 }}
                  transition={{ ...POP, delay: 0.06 }}
                  className="inline-block"
                >
                  <Trans>Sign</Trans>
                </motion.span>
              </motion.div>
            </div>

            <div className="mt-auto flex items-center gap-2.5 border-t bg-muted px-4 py-2.5">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                <Trans>Company details</Trans>
              </span>

              <motion.div
                initial={isStatic ? false : undefined}
                animate={{ backgroundColor: brand.accent }}
                transition={{ duration: 0.4 }}
                className="h-1.5 w-[54px] rounded-full"
                style={{ opacity: 0.45 }}
              />

              <motion.div
                initial={isStatic ? false : undefined}
                animate={{ backgroundColor: brand.accent }}
                transition={{ duration: 0.4 }}
                className="h-1.5 w-[34px] rounded-full"
                style={{ opacity: 0.22 }}
              />
            </div>

            {/*
             * Keyed remount replays the sweep per brand. No opacity envelope —
             * keyframe arrays are unreliable on strict-mode remounts; both
             * endpoints sit outside the overflow-hidden card, so the clip
             * provides the fade in/out instead.
             */}
            <motion.div
              key={`sheen-${brandIndex}`}
              initial={isStatic ? false : { x: '-130%' }}
              animate={{ x: '240%' }}
              transition={{ duration: 1.15, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-y-0 left-0 w-[55%]"
              style={{ background: `linear-gradient(105deg, transparent, ${brand.sheen}, transparent)` }}
            />
          </div>
        </div>
      }
    />
  );
};
