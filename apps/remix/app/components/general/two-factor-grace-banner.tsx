import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import type { TTwoFactorEnforcementStatus } from '@documenso/lib/utils/two-factor';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AlertTriangleIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';

type GraceBannerCandidate = {
  /**
   * Dismissal scope: `instance` or `org:<organisationId>`.
   */
  scope: string;
  deadline: Date;
  isSessionUnverified: boolean;
};

const buildDismissalKey = (userId: number, candidate: GraceBannerCandidate) =>
  `2fa-grace-banner:${userId}:${candidate.scope}:${candidate.deadline.getTime()}`;

const toCandidate = (
  status: TTwoFactorEnforcementStatus,
  scope: string,
  isSessionUnverified: boolean,
): GraceBannerCandidate | null => {
  // Banner territory is the grace window only: required, not yet satisfied,
  // not yet expired. Expiry is handled by the org 403 screen (and, for
  // instance enforcement, the onboarding redirect).
  if (!status.required || status.isSatisfied || status.isDeadlineExpired) {
    return null;
  }

  return {
    scope,
    deadline: status.deadline,
    isSessionUnverified,
  };
};

/**
 * Shared grace-period banner for 2FA enforcement.
 *
 * Shows the NEAREST applicable deadline between instance enforcement and the
 * current organisation's enforcement. Dismissal is stored in `sessionStorage`
 * keyed by userId + scope + deadline, so a changed deadline re-shows the
 * banner.
 */
export const TwoFactorGraceBanner = () => {
  const { i18n } = useLingui();

  const { sessionData } = useOptionalSession();
  const currentOrganisation = useOptionalCurrentOrganisation();

  const location = useLocation();

  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);

  const candidate = useMemo(() => {
    if (!sessionData) {
      return null;
    }

    const isSessionUnverified = sessionData.user.twoFactorEnabled && !sessionData.session.twoFactorVerified;

    const candidates = [
      toCandidate(sessionData.twoFactorEnforcement, 'instance', isSessionUnverified),
      currentOrganisation
        ? toCandidate(currentOrganisation.twoFactorEnforcement, `org:${currentOrganisation.id}`, isSessionUnverified)
        : null,
    ].filter((value): value is GraceBannerCandidate => value !== null);

    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((nearest, current) =>
      current.deadline.getTime() < nearest.deadline.getTime() ? current : nearest,
    );
  }, [sessionData, currentOrganisation]);

  if (!sessionData || !candidate) {
    return null;
  }

  const dismissalKey = buildDismissalKey(sessionData.user.id, candidate);

  const isDismissed =
    dismissedKeys.includes(dismissalKey) ||
    (typeof window !== 'undefined' && window.sessionStorage.getItem(dismissalKey) === 'true');

  if (isDismissed) {
    return null;
  }

  const onDismiss = () => {
    try {
      window.sessionStorage.setItem(dismissalKey, 'true');
    } catch {
      // Storage may be unavailable (private browsing); fall back to state.
    }

    setDismissedKeys((keys) => [...keys, dismissalKey]);
  };

  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);

  return (
    <div className="bg-yellow-200 dark:bg-yellow-400">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-x-4 px-4 py-2 font-medium text-sm text-yellow-900">
        <div className="flex items-center gap-x-2">
          <AlertTriangleIcon className="h-4 w-4 flex-shrink-0" />

          <span>
            {candidate.isSessionUnverified ? (
              <Trans>
                Two-factor authentication is required from {i18n.date(candidate.deadline, { dateStyle: 'long' })}.
                Two-factor authentication is enabled for your account, but this session has not been verified with a
                second factor — sign out and log back in to verify this session.
              </Trans>
            ) : (
              <Trans>
                Two-factor authentication is required from {i18n.date(candidate.deadline, { dateStyle: 'long' })}.{' '}
                <Link to={`/onboarding/2fa?returnTo=${returnTo}`} className="underline">
                  Enable it now
                </Link>{' '}
                to keep access.
              </Trans>
            )}
          </span>
        </div>

        <button
          type="button"
          className="rounded p-1 hover:bg-yellow-300 dark:hover:bg-yellow-500"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
