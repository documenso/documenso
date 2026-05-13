import { z } from 'zod';

export const ZDeleteOrganisationRequestSchema = z.object({
  organisationId: z.string().min(1),
  /**
   * The organisation name as typed by the admin in the confirmation dialog.
   * Must exactly match the persisted organisation's name for the deletion
   * to proceed.
   */
  organisationName: z.string().min(1),
  /**
   * Whether to email the organisation owner notifying them of the deletion.
   */
  sendEmailToOwner: z.boolean(),
});

export const ZDeleteOrganisationResponseSchema = z.void();

export type TDeleteOrganisationRequest = z.infer<typeof ZDeleteOrganisationRequestSchema>;
export type TDeleteOrganisationResponse = z.infer<typeof ZDeleteOrganisationResponseSchema>;
