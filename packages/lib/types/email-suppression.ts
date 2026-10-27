import { EmailSuppressionScope } from '@prisma/client';
import { z } from 'zod';

/**
 * Who a suppression stops emails from. Each scope carries the ID of its sender,
 * apart from GLOBAL which applies to every sender.
 */
export const ZEmailSuppressionTargetSchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal(EmailSuppressionScope.GLOBAL),
  }),
  z.object({
    scope: z.literal(EmailSuppressionScope.ORGANISATION),
    organisationId: z.string().trim().min(1),
  }),
  z.object({
    scope: z.literal(EmailSuppressionScope.TEAM),
    teamId: z.number().int().positive(),
  }),
  z.object({
    scope: z.literal(EmailSuppressionScope.USER),
    userId: z.number().int().positive(),
  }),
]);

export type TEmailSuppressionTarget = z.infer<typeof ZEmailSuppressionTargetSchema>;
