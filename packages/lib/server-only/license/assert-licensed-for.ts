import { AppError, AppErrorCode } from '../../errors/app-error';
import type { LicenseFlag, TCachedLicense } from '../../types/license';
import { env } from '../../utils/env';
import { LicenseClient } from './license-client';

type AssertLicensedForOptions = {
  /**
   * Override the AppError code thrown when the assertion fails.
   *
   * Defaults to `AppErrorCode.FORBIDDEN`. Callers that need a more specific
   * surface — for example the CSC transport throwing `CSC_UNLICENSED` at
   * transport-create time — pass their own code here.
   */
  errorCode?: string;

  /**
   * Override the AppError message thrown when the assertion fails.
   */
  message?: string;
};

/**
 * Assert the configured Documenso licence grants `flag`. Reads the
 * {@link LicenseClient} cache; never re-pings the licence server.
 *
 * - No `NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY` → throws. No licensing intent.
 * - Key set, claim unverifiable (no client, null cache, read throws,
 *   `license: null`) → passes. Mirrors how org-claim gates keep running on
 *   last known state when the licence server is unreachable; paying
 *   operators shouldn't be locked out by transient infra.
 * - Key set, claim loaded and denies the flag (bad standing or flag falsy)
 *   → throws.
 */
export const assertLicensedFor = async (flag: LicenseFlag, options?: AssertLicensedForOptions): Promise<void> => {
  const denied = (): AppError =>
    new AppError(options?.errorCode ?? AppErrorCode.FORBIDDEN, {
      message: options?.message ?? `License does not include the "${flag}" feature.`,
    });

  // No licence key configured = no licensing intent. Fail closed unconditionally
  // so unlicensed instances cannot reach gated features simply because the
  // licence cache is empty.
  if (!env('NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY')) {
    throw denied();
  }

  let cached: TCachedLicense | null = null;

  const licenseClient = LicenseClient.getInstance();

  if (licenseClient) {
    cached = await licenseClient?.getCachedLicense().catch(() => null);
  }

  // Licence key is configured but we have no positively-verified claim to
  // check. Fail-open — see block comment for the full set of conditions and
  // rationale.
  if (!cached?.license) {
    return;
  }

  const inGoodStanding = cached.derivedStatus === 'ACTIVE' || cached.derivedStatus === 'PAST_DUE';

  const flagGranted = Boolean(cached.license.flags[flag]);

  if (!inGoodStanding || !flagGranted) {
    throw denied();
  }
};
