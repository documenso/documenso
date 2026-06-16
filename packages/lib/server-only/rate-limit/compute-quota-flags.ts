import { QUOTA_WARNING_THRESHOLD } from './get-quota-alert-kind';

export type QuotaFlags = {
  isDocumentQuotaExceeded: boolean;
  isEmailQuotaExceeded: boolean;
  isApiQuotaExceeded: boolean;
  isDocumentQuotaNearing: boolean;
  isEmailQuotaNearing: boolean;
  isApiQuotaNearing: boolean;
};

type ComputeQuotaFlagsOptions = {
  quotas: {
    documentQuota: number | null;
    emailQuota: number | null;
    apiQuota: number | null;
  };
  usage?: {
    documentCount?: number;
    emailCount?: number;
    apiCount?: number;
  };
};

/**
 * A quota of `null` means unlimited (never exceeded). A quota of `0` means
 * blocked (always exceeded). Otherwise usage `>=` quota is exceeded.
 */
const isQuotaExceeded = (quota: number | null, usage: number): boolean => {
  if (quota === null) {
    return false;
  }

  if (quota === 0) {
    return true;
  }

  return usage >= quota;
};

/**
 * A counter is "nearing" its quota once usage reaches the warning threshold
 * (80% of the quota, rounded up) but has not yet been exceeded. Nearing and
 * exceeded are mutually exclusive per counter.
 */
const isQuotaNearing = (quota: number | null, usage: number): boolean => {
  if (quota === null || quota === 0) {
    return false;
  }

  if (isQuotaExceeded(quota, usage)) {
    return false;
  }

  return usage >= Math.ceil(quota * QUOTA_WARNING_THRESHOLD);
};

export const computeQuotaFlags = ({ quotas, usage }: ComputeQuotaFlagsOptions): QuotaFlags => {
  return {
    isDocumentQuotaExceeded: isQuotaExceeded(quotas.documentQuota, usage?.documentCount ?? 0),
    isEmailQuotaExceeded: isQuotaExceeded(quotas.emailQuota, usage?.emailCount ?? 0),
    isApiQuotaExceeded: isQuotaExceeded(quotas.apiQuota, usage?.apiCount ?? 0),
    isDocumentQuotaNearing: isQuotaNearing(quotas.documentQuota, usage?.documentCount ?? 0),
    isEmailQuotaNearing: isQuotaNearing(quotas.emailQuota, usage?.emailCount ?? 0),
    isApiQuotaNearing: isQuotaNearing(quotas.apiQuota, usage?.apiCount ?? 0),
  };
};
