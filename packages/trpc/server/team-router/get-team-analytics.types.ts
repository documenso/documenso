import { z } from 'zod';

/** Calendar units supported by team analytics. */
export const ZAnalyticsPeriodUnitSchema = z.enum(['day', 'week', 'month', 'year']);

/** Team analytics request filters. */
export const ZGetTeamAnalyticsRequestSchema = z.object({
  teamId: z.number().int().positive(),
  period: ZAnalyticsPeriodUnitSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).default('UTC'),
  senderIds: z.array(z.number().int().positive()).optional(),
});

const ZAnalyticsCountSchema = z.number().int().nonnegative();

/** Complete team analytics response. */
export const ZGetTeamAnalyticsResponseSchema = z.object({
  period: z.object({
    unit: ZAnalyticsPeriodUnitSchema,
    date: z.string(),
    timezone: z.string(),
    start: z.date(),
    end: z.date(),
  }),
  senderIds: z.array(z.number().int().positive()),
  owners: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string().nullable(),
      email: z.string(),
    }),
  ),
  activity: z.object({
    sent: ZAnalyticsCountSchema,
    completed: ZAnalyticsCountSchema,
    declined: ZAnalyticsCountSchema,
    cancelled: ZAnalyticsCountSchema,
  }),
  current: z.object({
    draft: ZAnalyticsCountSchema,
    pending: ZAnalyticsCountSchema,
  }),
  observedAt: z.date(),
  incompleteMetrics: z.array(z.enum(['sent', 'completed', 'declined', 'cancelled'])),
  hasDocuments: z.boolean(),
});

/** Parsed team analytics request. */
export type TGetTeamAnalyticsRequest = z.infer<typeof ZGetTeamAnalyticsRequestSchema>;

/** Parsed team analytics response. */
export type TGetTeamAnalyticsResponse = z.infer<typeof ZGetTeamAnalyticsResponseSchema>;
