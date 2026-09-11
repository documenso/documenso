import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DOCUMENSO_CLOUD_ENTERPRISE_CTA_URL } from '@documenso/lib/constants/app';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { cn } from '@documenso/ui/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BadgeCheckIcon, MailIcon } from 'lucide-react';
import { BrandingLogoIcon } from '../branding-logo-icon';
import { EASE, POP, SPRING } from './motion';
import { SettingsUpsellCard } from './settings-upsell-card';
import { useTimedCycle } from './use-timed-cycle';

/**
 * Named sender identities cycled through while the preview is in its branded
 * state — one per branded cycle step, shown as the sender name and address.
 */
const BRANDED_SENDERS = [
  { name: 'Support', email: 'support@example.com' },
  { name: 'Team', email: 'hello@example.com' },
  { name: 'Sales', email: 'sales@example.com' },
  { name: 'Example', email: 'noreply@example.com' },
];

/**
 * How long the initial unbranded (Documenso default) state is shown before
 * the first flip starts. Shown exactly once — the cycle never returns to it.
 */
const INITIAL_STATE_DURATION_MS = 2500;

/**
 * How long each branded sender identity is shown before cycling to the next,
 * giving the viewer time to read the changed address.
 */
const BRANDED_STATE_DURATION_MS = 5000;

/**
 * One duration per cycle step: the unbranded state first, then one step per
 * named sender identity, derived from the identity count so the two cannot
 * drift.
 */
const EMAIL_CYCLE_DURATIONS_MS = [INITIAL_STATE_DURATION_MS, ...BRANDED_SENDERS.map(() => BRANDED_STATE_DURATION_MS)];

export const EmailDomainsUpsell = () => {
  const organisation = useCurrentOrganisation();

  const isReducedMotion = useReducedMotion();

  // Loop from index 1: the unbranded Documenso intro plays exactly once,
  // then the cycle rotates through the branded senders only.
  const cycleIndex = useTimedCycle(EMAIL_CYCLE_DURATIONS_MS, 1);

  const isBranded = cycleIndex > 0;
  const brandedSender = BRANDED_SENDERS[cycleIndex - 1] ?? BRANDED_SENDERS[0];

  const isStatic = isReducedMotion ?? false;

  return (
    <SettingsUpsellCard
      planLabel={<Trans>Enterprise</Trans>}
      title={<Trans>Unlock Email Domains</Trans>}
      description={
        <Trans>Send documents from your own domain. Email domains are available on the Enterprise plan.</Trans>
      }
      features={[
        <Trans key="journey">Send emails to recipients from your domain</Trans>,
        <Trans key="dns">Easy DNS setup with auto-generated DKIM and SPF records</Trans>,
        <Trans key="senders">Named senders with defaults per team, template or document</Trans>,
      ]}
      ctaLabel={<Trans>Contact Sales</Trans>}
      ctaTo={DOCUMENSO_CLOUD_ENTERPRISE_CTA_URL}
      ctaExternal
      preview={
        <div className="mx-auto w-full max-w-xs">
          <div className="relative h-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isBranded ? 'chip-on' : 'chip-off'}
                initial={isStatic ? false : { opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={SPRING}
                className={cn(
                  'absolute inset-0 flex items-center gap-2 rounded-full border bg-background px-3 font-mono text-xs',
                  isBranded ? 'border-documenso-300 text-documenso-800' : 'text-muted-foreground',
                )}
              >
                {isBranded ? (
                  <BadgeCheckIcon className="h-3.5 w-3.5 shrink-0 text-documenso-700" />
                ) : (
                  <MailIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}

                <span className="truncate">
                  {isBranded ? <Trans>Sending from your domain</Trans> : <Trans>Sending from app.documenso.com</Trans>}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative mt-4 overflow-hidden rounded-lg border bg-background shadow-sm">
            <div className="flex items-center gap-2 border-b p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold text-sm">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={`logo-${cycleIndex}`}
                    initial={isStatic ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22 }}
                  >
                    {/*
                     * Remounts with its keyed parent on every cycle step so the
                     * pop replays each change. Single-value spring (POP
                     * overshoots past 1) instead of scale keyframes — keyframe
                     * arrays are unreliable on strict-mode remounts.
                     */}
                    <motion.span
                      initial={isStatic ? false : { scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ scale: POP }}
                      className="inline-block"
                    >
                      {isBranded ? (
                        <Avatar className="h-8 w-8 border border-solid">
                          {organisation.avatarImageId && (
                            <AvatarImage src={formatAvatarUrl(organisation.avatarImageId)} />
                          )}
                          <AvatarFallback className="text-sm">{brandedSender.name[0]}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <BrandingLogoIcon className="h-8 w-8" />
                      )}
                    </motion.span>
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="min-w-0">
                <div className="font-medium text-sm">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`name-${cycleIndex}`}
                      initial={isStatic ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.28, ease: EASE }}
                      className="flex min-w-0 items-center gap-1.5"
                    >
                      <span className="min-w-0 truncate">{isBranded ? brandedSender.name : 'Documenso'}</span>

                      {/* Inside the keyed row so it exits with the name and pops back in on every cycle step. */}
                      {isBranded && (
                        <motion.span
                          initial={isStatic ? false : { scale: 0, rotate: -40 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ ...POP, delay: 0.12 }}
                          className="shrink-0"
                        >
                          <BadgeCheckIcon className="h-3.5 w-3.5 text-documenso-700" />
                        </motion.span>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="font-mono text-muted-foreground text-xs">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={`addr-${cycleIndex}`}
                      initial={isStatic ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.28, ease: EASE }}
                      className="truncate"
                    >
                      {isBranded ? brandedSender.email : 'noreply@app.documenso.com'}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="p-4">
              <p className="font-medium text-sm">
                <Trans>Please sign: Example.pdf</Trans>
              </p>

              <p className="mt-1 text-muted-foreground text-xs">
                <Trans>{organisation.name} has invited you to sign this document.</Trans>
              </p>
            </div>

            {/*
             * Keyed remount replays the sweep on every cycle step. No opacity
             * envelope — keyframe arrays are unreliable on strict-mode
             * remounts; both endpoints sit outside the overflow-hidden card,
             * so the clip provides the fade in/out instead.
             */}
            <motion.div
              key={`sheen-${cycleIndex}`}
              initial={isStatic ? false : { x: '-130%' }}
              animate={{ x: '240%' }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-y-0 left-0 w-[55%]"
              style={{ background: 'linear-gradient(105deg, transparent, rgba(162, 231, 113, 0.32), transparent)' }}
            />
          </div>
        </div>
      }
    />
  );
};
