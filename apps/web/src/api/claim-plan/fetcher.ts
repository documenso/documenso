import type { ClaimPlanPostResponse, TClaimPlanRequestSchema } from '~/app/api/claim-plan/route';

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

  const body = (await response.json()) as ClaimPlanPostResponse;

  if (response.status !== 200) {
    throw new Error('Failed to claim plan');
  }

  if (!body.success) {
    throw new Error(`Failed to claim plan: ${body.message}`);
  }

  return body.data.redirectUrl;
};
