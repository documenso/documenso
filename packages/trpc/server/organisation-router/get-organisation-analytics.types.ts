import { z } from 'zod';

import {
  ZAnalyticsRangeFieldsSchema,
  ZGetTeamAnalyticsDocumentsOverTimeResponseSchema,
  ZGetTeamAnalyticsStatusBreakdownResponseSchema,
  ZTeamAnalyticsResolvedRangeSchema,
} from '../team-router/get-team-analytics.types';

/**
 * Base request shared by every organisation analytics procedure.
 *
 * Organisation analytics are restricted to organisation ADMINs. The organisation
 * ADMIN role authorises organisation-wide visibility: the internal ADMIN group is
 * attached to every team by `createTeam` and cannot be detached, so every document
 * in the organisation is in scope and no per-document visibility filtering is applied.
 */
export const ZOrganisationAnalyticsRequestSchema = ZAnalyticsRangeFieldsSchema.extend({
  organisationId: z.string().min(1),
});

export type TOrganisationAnalyticsRequest = z.infer<typeof ZOrganisationAnalyticsRequestSchema>;

const ZCountSchema = z.number().int().nonnegative();

const ZAnalyticsTeamSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  url: z.string(),
  avatarImageId: z.string().nullable(),
});

// -----------------------------------------------------------------------------
// organisation.analytics.getOverview
// -----------------------------------------------------------------------------

export const ZGetOrganisationAnalyticsOverviewRequestSchema = ZOrganisationAnalyticsRequestSchema;

export const ZGetOrganisationAnalyticsOverviewResponseSchema = z.object({
  range: ZTeamAnalyticsResolvedRangeSchema,
  /** Documents whose DOCUMENT_SENT event falls inside the window. */
  sent: z.object({
    current: ZCountSchema,
    previous: ZCountSchema,
  }),
  /** Of documents sent in the window, how many are currently COMPLETED. */
  completionRate: z.object({
    completed: ZCountSchema,
    sent: ZCountSchema,
    rate: z.number().min(0).max(100).nullable(),
    previousRate: z.number().min(0).max(100).nullable(),
  }),
  teams: z.object({
    /** Total number of teams in the organisation. */
    total: ZCountSchema,
    /** Teams with at least one document sent in the window. */
    active: ZCountSchema,
  }),
});

export type TGetOrganisationAnalyticsOverviewRequest = z.infer<typeof ZGetOrganisationAnalyticsOverviewRequestSchema>;
export type TGetOrganisationAnalyticsOverviewResponse = z.infer<typeof ZGetOrganisationAnalyticsOverviewResponseSchema>;

// -----------------------------------------------------------------------------
// organisation.analytics.getDocumentsOverTime
// -----------------------------------------------------------------------------

export const ZGetOrganisationAnalyticsDocumentsOverTimeRequestSchema = ZOrganisationAnalyticsRequestSchema;

export const ZGetOrganisationAnalyticsDocumentsOverTimeResponseSchema =
  ZGetTeamAnalyticsDocumentsOverTimeResponseSchema;

export type TGetOrganisationAnalyticsDocumentsOverTimeRequest = z.infer<
  typeof ZGetOrganisationAnalyticsDocumentsOverTimeRequestSchema
>;
export type TGetOrganisationAnalyticsDocumentsOverTimeResponse = z.infer<
  typeof ZGetOrganisationAnalyticsDocumentsOverTimeResponseSchema
>;

// -----------------------------------------------------------------------------
// organisation.analytics.getStatusBreakdown
// -----------------------------------------------------------------------------

export const ZGetOrganisationAnalyticsStatusBreakdownRequestSchema = ZOrganisationAnalyticsRequestSchema;

export const ZGetOrganisationAnalyticsStatusBreakdownResponseSchema = ZGetTeamAnalyticsStatusBreakdownResponseSchema;

export type TGetOrganisationAnalyticsStatusBreakdownRequest = z.infer<
  typeof ZGetOrganisationAnalyticsStatusBreakdownRequestSchema
>;
export type TGetOrganisationAnalyticsStatusBreakdownResponse = z.infer<
  typeof ZGetOrganisationAnalyticsStatusBreakdownResponseSchema
>;

// -----------------------------------------------------------------------------
// organisation.analytics.getTemplateUsage
// -----------------------------------------------------------------------------

export const ZGetOrganisationAnalyticsTemplateUsageRequestSchema = ZOrganisationAnalyticsRequestSchema.extend({
  limit: z.number().int().min(1).max(20).default(5),
});

/** Templates across the organisation ranked by documents created from them inside the window. */
export const ZGetOrganisationAnalyticsTemplateUsageResponseSchema = z.object({
  range: ZTeamAnalyticsResolvedRangeSchema,
  templates: z.array(
    z.object({
      /** Legacy numeric template id (Envelope.templateId on documents). */
      id: z.number().int().positive(),
      /** Envelope id of the template, null when the template was deleted. */
      envelopeId: z.string().nullable(),
      title: z.string().nullable(),
      updatedAt: z.date().nullable(),
      /** Team the template belongs to, null when the template was deleted. */
      team: ZAnalyticsTeamSchema.nullable(),
      count: ZCountSchema,
    }),
  ),
});

export type TGetOrganisationAnalyticsTemplateUsageRequest = z.infer<
  typeof ZGetOrganisationAnalyticsTemplateUsageRequestSchema
>;
export type TGetOrganisationAnalyticsTemplateUsageResponse = z.infer<
  typeof ZGetOrganisationAnalyticsTemplateUsageResponseSchema
>;

// -----------------------------------------------------------------------------
// organisation.analytics.getTeamActivity
// -----------------------------------------------------------------------------

export const ZGetOrganisationAnalyticsTeamActivityRequestSchema = ZOrganisationAnalyticsRequestSchema;

/**
 * Per-team activity for every team in the organisation. Teams with no activity
 * are included with zeros. Sorted by sent desc, then name asc.
 */
export const ZGetOrganisationAnalyticsTeamActivityResponseSchema = z.object({
  range: ZTeamAnalyticsResolvedRangeSchema,
  teams: z.array(
    ZAnalyticsTeamSchema.extend({
      /** Documents sent by this team inside the window. */
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

export type TGetOrganisationAnalyticsTeamActivityRequest = z.infer<
  typeof ZGetOrganisationAnalyticsTeamActivityRequestSchema
>;
export type TGetOrganisationAnalyticsTeamActivityResponse = z.infer<
  typeof ZGetOrganisationAnalyticsTeamActivityResponseSchema
>;
