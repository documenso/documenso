import { IANAZone } from 'luxon';
import { z } from 'zod';

/** Preset date ranges supported by analytics, plus a custom [from, to] window. */
export const ZTeamAnalyticsRangeSchema = z.enum(['7d', '30d', '90d', '12m', 'custom']);

export type TTeamAnalyticsRange = z.infer<typeof ZTeamAnalyticsRangeSchema>;

/** Calendar date in the request timezone, formatted yyyy-MM-dd. */
export const ZAnalyticsDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected yyyy-MM-dd');

/** How far back a custom range may start: one year and one day before today. */
export const ANALYTICS_CUSTOM_RANGE_MAX_LOOKBACK = { years: 1, days: 1 } as const;

/**
 * Range fields shared by team and organisation analytics requests.
 *
 * `from` and `to` are inclusive calendar dates and are required when `range` is
 * `custom`, ignored otherwise. Combined validation happens in the range resolver so
 * this object stays extendable.
 */
export const ZAnalyticsRangeFieldsSchema = z.object({
  range: ZTeamAnalyticsRangeSchema.default('30d'),
  from: ZAnalyticsDateSchema.optional(),
  to: ZAnalyticsDateSchema.optional(),
  /** IANA timezone used to resolve day boundaries and buckets. */
  timezone: z
    .string()
    .min(1)
    .refine((timezone) => IANAZone.isValidZone(timezone), { message: 'Invalid timezone' })
    .default('UTC'),
});

export type TAnalyticsRangeFields = z.infer<typeof ZAnalyticsRangeFieldsSchema>;

/** Base request shared by every team analytics procedure. */
export const ZTeamAnalyticsRequestSchema = ZAnalyticsRangeFieldsSchema.extend({
  teamId: z.number().int().positive(),
});

export type TTeamAnalyticsRequest = z.infer<typeof ZTeamAnalyticsRequestSchema>;

const ZCountSchema = z.number().int().nonnegative();

/** Resolved half-open date window, plus the equally sized window immediately before it. */
export const ZTeamAnalyticsResolvedRangeSchema = z.object({
  range: ZTeamAnalyticsRangeSchema,
  /** Inclusive calendar bounds of the window in the request timezone, yyyy-MM-dd. */
  from: ZAnalyticsDateSchema,
  to: ZAnalyticsDateSchema,
  timezone: z.string(),
  start: z.date(),
  end: z.date(),
  previousStart: z.date(),
  previousEnd: z.date(),
  bucket: z.enum(['day', 'month']),
});

export type TTeamAnalyticsResolvedRange = z.infer<typeof ZTeamAnalyticsResolvedRangeSchema>;

// -----------------------------------------------------------------------------
// team.analytics.getOverview
// -----------------------------------------------------------------------------

export const ZGetTeamAnalyticsOverviewRequestSchema = ZTeamAnalyticsRequestSchema;

export const ZGetTeamAnalyticsOverviewResponseSchema = z.object({
  range: ZTeamAnalyticsResolvedRangeSchema,
  /** Documents whose first DOCUMENT_SENT event falls inside the window. */
  sent: z.object({
    current: ZCountSchema,
    previous: ZCountSchema,
  }),
  /** Of documents sent in the window, how many are currently COMPLETED. */
  completionRate: z.object({
    completed: ZCountSchema,
    sent: ZCountSchema,
    /** 0-100, null when nothing was sent. */
    rate: z.number().min(0).max(100).nullable(),
    /** Previous window rate, null when nothing was sent then. */
    previousRate: z.number().min(0).max(100).nullable(),
  }),
  members: z.object({
    /** Total number of users who are members of the team. */
    total: ZCountSchema,
    /** Distinct team members who sent at least one visible document in the window. */
    active: ZCountSchema,
  }),
});

export type TGetTeamAnalyticsOverviewRequest = z.infer<typeof ZGetTeamAnalyticsOverviewRequestSchema>;
export type TGetTeamAnalyticsOverviewResponse = z.infer<typeof ZGetTeamAnalyticsOverviewResponseSchema>;

// -----------------------------------------------------------------------------
// team.analytics.getDocumentsOverTime
// -----------------------------------------------------------------------------

export const ZGetTeamAnalyticsDocumentsOverTimeRequestSchema = ZTeamAnalyticsRequestSchema;

export const ZGetTeamAnalyticsDocumentsOverTimeResponseSchema = z.object({
  range: ZTeamAnalyticsResolvedRangeSchema,
  total: ZCountSchema,
  /** Zero-filled, ordered ascending. `date` is the bucket start as yyyy-MM-dd in the request timezone. */
  points: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      count: ZCountSchema,
    }),
  ),
});

export type TGetTeamAnalyticsDocumentsOverTimeRequest = z.infer<typeof ZGetTeamAnalyticsDocumentsOverTimeRequestSchema>;
export type TGetTeamAnalyticsDocumentsOverTimeResponse = z.infer<
  typeof ZGetTeamAnalyticsDocumentsOverTimeResponseSchema
>;

// -----------------------------------------------------------------------------
// team.analytics.getStatusBreakdown
// -----------------------------------------------------------------------------

export const ZGetTeamAnalyticsStatusBreakdownRequestSchema = ZTeamAnalyticsRequestSchema;

/** Current status of documents created inside the window. */
export const ZGetTeamAnalyticsStatusBreakdownResponseSchema = z.object({
  range: ZTeamAnalyticsResolvedRangeSchema,
  total: ZCountSchema,
  draft: ZCountSchema,
  pending: ZCountSchema,
  completed: ZCountSchema,
  rejected: ZCountSchema,
  cancelled: ZCountSchema,
});

export type TGetTeamAnalyticsStatusBreakdownRequest = z.infer<typeof ZGetTeamAnalyticsStatusBreakdownRequestSchema>;
export type TGetTeamAnalyticsStatusBreakdownResponse = z.infer<typeof ZGetTeamAnalyticsStatusBreakdownResponseSchema>;

// -----------------------------------------------------------------------------
// team.analytics.getTemplateUsage
// -----------------------------------------------------------------------------

export const ZGetTeamAnalyticsTemplateUsageRequestSchema = ZTeamAnalyticsRequestSchema.extend({
  limit: z.number().int().min(1).max(20).default(5),
});

/** Templates ranked by the number of visible documents created from them inside the window. */
export const ZGetTeamAnalyticsTemplateUsageResponseSchema = z.object({
  range: ZTeamAnalyticsResolvedRangeSchema,
  templates: z.array(
    z.object({
      /** Legacy numeric template id (Envelope.templateId on documents). */
      id: z.number().int().positive(),
      /** Envelope id of the template, null when the template was deleted or is not visible to the caller. */
      envelopeId: z.string().nullable(),
      title: z.string().nullable(),
      updatedAt: z.date().nullable(),
      count: ZCountSchema,
    }),
  ),
});

export type TGetTeamAnalyticsTemplateUsageRequest = z.infer<typeof ZGetTeamAnalyticsTemplateUsageRequestSchema>;
export type TGetTeamAnalyticsTemplateUsageResponse = z.infer<typeof ZGetTeamAnalyticsTemplateUsageResponseSchema>;

// -----------------------------------------------------------------------------
// team.analytics.getMemberActivity
// -----------------------------------------------------------------------------

export const ZGetTeamAnalyticsMemberActivityRequestSchema = ZTeamAnalyticsRequestSchema;

/**
 * Per-member activity for every current team member, scoped to documents the
 * caller can see. Members with no visible activity are included with zeros.
 * Sorted by sent desc, then name asc.
 */
export const ZGetTeamAnalyticsMemberActivityResponseSchema = z.object({
  range: ZTeamAnalyticsResolvedRangeSchema,
  members: z.array(
    z.object({
      userId: z.number().int().positive(),
      name: z.string().nullable(),
      email: z.string(),
      avatarImageId: z.string().nullable(),
      /** Visible documents first sent by this member inside the window. */
      sent: ZCountSchema,
      /** Of `sent`, currently COMPLETED. */
      completed: ZCountSchema,
      /** Of `sent`, currently PENDING. */
      pending: ZCountSchema,
      /** 0-100, null when `sent` is 0. */
      completionRate: z.number().min(0).max(100).nullable(),
      /** Most recent send inside the window, null when none. */
      lastActiveAt: z.date().nullable(),
    }),
  ),
});

export type TGetTeamAnalyticsMemberActivityRequest = z.infer<typeof ZGetTeamAnalyticsMemberActivityRequestSchema>;
export type TGetTeamAnalyticsMemberActivityResponse = z.infer<typeof ZGetTeamAnalyticsMemberActivityResponseSchema>;
