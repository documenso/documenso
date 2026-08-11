import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { DOCUMENSO_CLOUD_ENTERPRISE_CTA_URL } from '@documenso/lib/constants/app';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FingerprintIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { EASE, POP, SPRING } from './motion';
import { SettingsUpsellCard } from './settings-upsell-card';
import { useTimedCycle } from './use-timed-cycle';

export const SsoPortalUpsell = () => {
  const isReducedMotion = useReducedMotion();
  const sceneIndex = useTimedCycle(SSO_SCENE_DURATIONS_MS);

  return (
    <SettingsUpsellCard
      planLabel={<Trans>Enterprise</Trans>}
      title={<Trans>Unlock the Organisation SSO Portal</Trans>}
      description={
        <Trans>
          Give your members a dedicated single sign-on portal. The SSO portal is available on the Enterprise plan.
        </Trans>
      }
      features={[
        <Trans key="oidc">Works with any OIDC provider — Okta, Entra ID, Google and more</Trans>,
        <Trans key="jit">Accounts are automatically added to your organisation on sign-in</Trans>,
        <Trans key="control">Restrict sign-ins by email domain and choose the default role</Trans>,
      ]}
      ctaLabel={<Trans>Contact Sales</Trans>}
      ctaTo={DOCUMENSO_CLOUD_ENTERPRISE_CTA_URL}
      ctaExternal
      preview={
        <div className="mx-auto w-full max-w-xs">
          <div className="relative h-[236px]">
            <AnimatePresence mode="wait" initial={false}>
              {sceneIndex === 0 && <PortalScene key="portal" isStatic={isReducedMotion ?? false} />}
              {sceneIndex === 1 && <RedirectScene key="redirect" />}
              {sceneIndex === 2 && <SuccessScene key="success" />}
            </AnimatePresence>
          </div>
        </div>
      }
    />
  );
};

/**
 * Absolute-positioned panel each scene renders in, handling the shared
 * slide-and-fade transition between scenes.
 */
const ScenePanel = ({ children }: { children: ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ duration: 0.34, ease: EASE }}
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-lg border bg-background p-6 text-center shadow-sm"
    >
      {children}
    </motion.div>
  );
};

/**
 * Scene 1: the organisation's SSO portal, with a timed faux press on the
 * "Continue with SSO" button (cursor flies in, button dips, sheen sweeps).
 *
 * When `isStatic` is set (reduced motion) every element renders with
 * `initial={false}`, skipping entrance and press animations.
 */
const PortalScene = ({ isStatic }: { isStatic: boolean }) => {
  const organisation = useCurrentOrganisation();

  const rise = (delay: number) => ({
    initial: isStatic ? false : { y: 10, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { ...SPRING, delay },
  });

  return (
    <ScenePanel>
      <motion.div
        initial={isStatic ? false : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...POP, delay: 0.04 }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-documenso-200 font-semibold text-documenso-900">
          {organisation.name[0]?.toUpperCase() || 'D'}
        </div>
      </motion.div>

      <motion.p {...rise(0.12)} className="mt-3.5 font-semibold text-sm">
        <Trans>Welcome to {organisation.name}</Trans>
      </motion.p>

      <motion.p {...rise(0.18)} className="mt-1 text-muted-foreground text-xs">
        <Trans>Single sign-on</Trans>
      </motion.p>

      <div className="relative mt-4 w-full">
        <motion.div
          initial={isStatic ? false : { y: 10, opacity: 0, scale: 1 }}
          animate={{ y: 0, opacity: 1, scale: [1, 1, 0.955, 1] }}
          transition={{
            y: { ...SPRING, delay: 0.24 },
            opacity: { duration: 0.3, delay: 0.24 },
            scale: { duration: 2.6, times: [0, 0.63, 0.72, 0.84], ease: 'easeOut' },
          }}
          className="relative flex h-[38px] w-full items-center justify-center overflow-hidden rounded-md bg-foreground font-semibold text-background text-sm"
        >
          <span>
            <Trans>Continue with SSO</Trans>
          </span>

          <motion.div
            initial={isStatic ? false : { x: '-130%' }}
            animate={{ x: '150%' }}
            transition={{ duration: 0.85, delay: 1.75, ease: 'easeOut' }}
            className="absolute top-0 bottom-0 left-[20%] w-3/5"
            style={{ background: 'linear-gradient(105deg, transparent, rgba(162, 231, 113, 0.45), transparent)' }}
          />
        </motion.div>

        <motion.svg
          initial={isStatic ? false : { x: 30, y: 30, opacity: 0, scale: 1 }}
          animate={{
            x: [30, 30, 0, 0, 0],
            y: [30, 30, 0, 0, 0],
            opacity: [0, 1, 1, 1, 0],
            scale: [1, 1, 1, 0.82, 1],
          }}
          transition={{ duration: 2.6, times: [0, 0.3, 0.63, 0.72, 0.94], ease: EASE }}
          width={17}
          height={17}
          viewBox="0 0 24 24"
          strokeWidth={1.4}
          strokeLinejoin="round"
          className="absolute right-[26px] -bottom-2.5 fill-foreground stroke-background"
        >
          <path d="M4 2.5 19 12l-6.6 1.4L9.7 19.6z" />
        </motion.svg>
      </div>
    </ScenePanel>
  );
};

/**
 * Scene 2: redirecting to the identity provider, with a rotating ring around
 * a fingerprint tile and a filling progress bar.
 */
const RedirectScene = () => {
  return (
    <ScenePanel>
      <div className="relative flex h-[46px] w-[46px] items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.95, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          className="absolute inset-0 rounded-full border-2"
          style={{ borderTopColor: '#A2E771' }}
        />

        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-muted">
          <FingerprintIcon className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.6} />
        </div>
      </div>

      <motion.p
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING, delay: 0.08 }}
        className="mt-3.5 max-w-[22ch] text-sm"
      >
        <Trans>Redirecting to your identity provider</Trans>
      </motion.p>

      <div className="mt-4 h-1 w-[140px] overflow-hidden rounded-full bg-border">
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.35, ease: 'easeInOut' }}
          className="h-full rounded-full bg-documenso"
        />
      </div>
    </ScenePanel>
  );
};

/**
 * Scene 3: signed in, with an expanding pulse ring, a popping green circle,
 * a drawn checkmark and the signed-in member's email.
 */
const SuccessScene = () => {
  const { user } = useSession();

  return (
    <ScenePanel>
      <div className="relative h-10 w-10">
        <motion.div
          initial={{ scale: 0.7, opacity: 0.85 }}
          animate={{ scale: 2.1, opacity: 0 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: '#A2E771' }}
        />

        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={POP}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-documenso-200"
        >
          <svg
            width={19}
            height={19}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-documenso-900"
          >
            <motion.path
              d="M20 6 9 17l-5-5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.12, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>
      </div>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING, delay: 0.16 }}
        className="mt-3.5 font-semibold text-sm"
      >
        <Trans>Signed in</Trans>
      </motion.p>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING, delay: 0.24 }}
        className="mt-1 font-mono text-muted-foreground text-xs"
      >
        {user.email}
      </motion.p>
    </ScenePanel>
  );
};

/**
 * Milliseconds each scene is shown before advancing: portal, redirect,
 * success.
 */
const SSO_SCENE_DURATIONS_MS = [3000, 2500, 3000];
