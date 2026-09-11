export const QUOTA_WARNING_THRESHOLD = 0.8;

/**
 * Monthly quotas: `null` = unlimited, `0` = blocked. Usage `>=` quota is exceeded.
 */
export const isQuotaExceeded = (quota: number | null, usage: number): boolean => {
  if (quota === null) {
    return false;
  }

  if (quota === 0) {
    return true;
  }

  return usage >= quota;
};

/**
 * The usage count at which a positive quota starts "nearing" (80% rounded up).
 * The single source for the warning threshold math so the UI panel, quota flags,
 * and the per-request alert path can't drift apart.
 */
export const getQuotaWarningCount = (quota: number): number => {
  return Math.ceil(quota * QUOTA_WARNING_THRESHOLD);
};

/**
 * Nearing once usage reaches the warning threshold (80% rounded up) but is not exceeded.
 */
export const isQuotaNearing = (quota: number | null, usage: number): boolean => {
  if (quota === null || quota === 0) {
    return false;
  }

  if (isQuotaExceeded(quota, usage)) {
    return false;
  }

  return usage >= getQuotaWarningCount(quota);
};

export const getQuotaUsagePercent = (usage: number, quota: number | null): number => {
  if (quota === null || quota <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((usage / quota) * 100));
};

/** Member/team capacity limits use `0` for unlimited. */
export const normalizeCapacityLimit = (limit: number): number | null => {
  if (limit === 0) {
    return null;
  }

  return limit;
};
