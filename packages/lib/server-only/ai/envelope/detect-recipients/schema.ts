import { RecipientRole } from '@prisma/client';
import { z } from 'zod';

export const ZDetectedRecipientSchema = z.object({
  name: z.string().describe('The detected recipient name, leave blank if unknown'),
  email: z.string().describe('The detected recipient email, leave blank if unknown'),
  role: z
    .nativeEnum(RecipientRole)
    .optional()
    .default(RecipientRole.SIGNER)
    .describe(
      'The detected recipient role. Use SIGNER for people who need to sign, APPROVER for approvers, CC for people who should receive a copy, VIEWER for view-only recipients',
    ),
});

export type TDetectedRecipientSchema = z.infer<typeof ZDetectedRecipientSchema>;

export const ZDetectedRecipientsSchema = z.object({
  recipients: z
    .array(ZDetectedRecipientSchema)
    .describe('The list of detected recipients from the document'),
});

export type TDetectedRecipientsSchema = z.infer<typeof ZDetectedRecipientsSchema>;
