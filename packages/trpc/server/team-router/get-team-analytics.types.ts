import { z } from 'zod';

/**
 * Calendar period presets for the team analytics dashboard.
 *
 * Kept structurally in sync with `ZAnalyticsPeriodSchema` in
 * `@documenso/lib/server-only/team/get-team-analytics`. This schema is duplicated
 * here (rather than imported) so the request types stay client-safe and never
 * pull server-only code into the browser bundle. The compiler enforces parity
 * where the resolved `period` is handed to `resolveAnalyticsPeriod` in the route.
 */
export const ZAnalyticsPeriodSchema = z.enum([
  'week',
  'month',
  'quarter',
  'year',
  'lastMonth',
  'last7Days',
  'last30Days',
]);

export const ZGetTeamAnalyticsRequestSchema = z.object({
  teamId: z.number(),
  period: ZAnalyticsPeriodSchema.optional(),
  timezone: z.string().optional(),
  senderIds: z.array(z.number()).optional(),
});

export const ZGetTeamAnalyticsResponseSchema = z.object({
  sent: z.number(),
  draft: z.number(),
  pending: z.number(),
  completed: z.number(),
  declined: z.number(),
});

export type TGetTeamAnalyticsRequest = z.infer<typeof ZGetTeamAnalyticsRequestSchema>;
export type TGetTeamAnalyticsResponse = z.infer<typeof ZGetTeamAnalyticsResponseSchema>;
