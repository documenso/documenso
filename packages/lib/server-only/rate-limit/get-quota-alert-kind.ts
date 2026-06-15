export const QUOTA_WARNING_THRESHOLD = 0.8;

export type QuotaAlertKind = 'quota' | 'quotaNearing';

type GetQuotaAlertKindOptions = {
  previousCount: number;
  newCount: number;
  quota: number;
};

/**
 * Determines whether the request that moved the counter from `previousCount` to
 * `newCount` crossed an alert threshold.
 *
 * - 'quota': this request reached (or jumped past) the monthly quota.
 * - 'quotaNearing': this request reached the warning threshold (80% of quota).
 * - null: no threshold crossed by this request.
 *
 * Precondition: callers must handle `quota === null` (unlimited) and `quota === 0`
 * (blocked) before calling — this function assumes a positive quota.
 */
export const getQuotaAlertKind = (opts: GetQuotaAlertKindOptions): QuotaAlertKind | null => {
  const { previousCount, newCount, quota } = opts;

  if (newCount >= quota) {
    // Only the single request that reached the quota boundary should alert. If the
    // same request also skipped past the warning threshold, the quota alert
    // supersedes the warning.
    return previousCount < quota ? 'quota' : null;
  }

  // From here newCount < quota, so for tiny quotas (1-4) where the rounded-up
  // warning threshold equals the quota itself, the warning can never fire — the
  // exhausting request is handled by the quota branch above.
  const warningCount = Math.ceil(quota * QUOTA_WARNING_THRESHOLD);

  const didCrossWarning = newCount >= warningCount && previousCount < warningCount;

  return didCrossWarning ? 'quotaNearing' : null;
};
