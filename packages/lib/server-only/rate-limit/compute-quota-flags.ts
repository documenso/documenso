import { isQuotaExceeded, isQuotaNearing } from '../../universal/quota-usage';

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
