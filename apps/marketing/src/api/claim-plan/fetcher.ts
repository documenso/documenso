import type { TClaimPlanRequestSchema } from './types';
import { ZClaimPlanResponseSchema } from './types';

export const claimPlan = async ({
  name,
  email,
  planId,
  signatureDataUrl,
  signatureText,
}: TClaimPlanRequestSchema) => {
  const response = await fetch('/api/claim-plan', {
    method: 'POST',
    body: JSON.stringify({
      name,
      email,
      planId,
      signatureDataUrl,
      signatureText,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const body = await response.json();

  if (response.status !== 200) {
    throw new Error('პაკეტის გააქტიურება ვერ მოხერხდა');
  }

  const safeBody = ZClaimPlanResponseSchema.safeParse(body);

  if (!safeBody.success) {
    throw new Error('პაკეტის გააქტიურება ვერ მოხერხდა');
  }

  if ('error' in safeBody.data) {
    throw new Error(safeBody.data.error);
  }

  return safeBody.data.redirectUrl;
};
