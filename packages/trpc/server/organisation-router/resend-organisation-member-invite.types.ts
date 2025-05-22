import { z } from 'zod';

// export const resendOrganisationMemberInviteMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation/member/resend-invite',
//     summary: 'Resend organisation member invite',
//     description: 'Resend a organisation member invite',
//     tags: ['Organisation'],
//   },
// };

export const ZResendOrganisationMemberInviteRequestSchema = z.object({
  organisationId: z.string(),
  invitationId: z.string(),
});

export const ZResendOrganisationMemberInviteResponseSchema = z.void();
