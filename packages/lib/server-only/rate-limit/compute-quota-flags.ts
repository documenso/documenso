export type QuotaFlags = {
  isDocumentQuotaExceeded: boolean;
  isEmailQuotaExceeded: boolean;
  isApiQuotaExceeded: boolean;
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
 *
 * Note: this `>=` is intentionally the "reached" signal for the banner and is
 * distinct from enforcement in `check-monthly-quota.ts`, which blocks the
 * action that crosses the boundary using a strict `>` on the post-increment
 * count. Do not "align" them — they answer different questions.
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

export const computeQuotaFlags = ({ quotas, usage }: ComputeQuotaFlagsOptions): QuotaFlags => {
  return {
    isDocumentQuotaExceeded: isQuotaExceeded(quotas.documentQuota, usage?.documentCount ?? 0),
    isEmailQuotaExceeded: isQuotaExceeded(quotas.emailQuota, usage?.emailCount ?? 0),
    isApiQuotaExceeded: isQuotaExceeded(quotas.apiQuota, usage?.apiCount ?? 0),
  };
};
