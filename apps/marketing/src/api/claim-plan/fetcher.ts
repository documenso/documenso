import { TClaimPlanRequestSchema, ZClaimPlanResponseSchema } from './types';

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
    throw new Error('Failed to claim plan');
  }

  const safeBody = ZClaimPlanResponseSchema.safeParse(body);

  if (!safeBody.success) {
    throw new Error('Failed to claim plan');
  }

  if ('error' in safeBody.data) {
    throw new Error(safeBody.data.error);
  }

  return safeBody.data.redirectUrl;
};
