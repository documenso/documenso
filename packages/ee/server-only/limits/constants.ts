import type { TLimitsSchema } from './schema';

export const FREE_PLAN_LIMITS: TLimitsSchema = {
  documents: 5,
  recipients: 10,
  directTemplates: 3,
};

export const INACTIVE_PLAN_LIMITS: TLimitsSchema = {
  documents: 0,
  recipients: 0,
  directTemplates: 0,
};

export const PAID_PLAN_LIMITS: TLimitsSchema = {
  documents: Infinity,
  recipients: Infinity,
  directTemplates: Infinity,
};

export const SELFHOSTED_PLAN_LIMITS: TLimitsSchema = {
  documents: Infinity,
  recipients: Infinity,
  directTemplates: Infinity,
};

/**
 * Used as an initial value for the frontend before values are loaded from the server.
 */
export const DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT = 5;

/**
 * Used as an initial value for the frontend before values are loaded from the server.
 *
 * 0 = Unlimited recipients.
 */
export const DEFAULT_RECIPIENT_COUNT = 20;

/**
 * The number of contents allowed on a single envelope.
 *
 * 0 = Unlimited contents.
 */
export const DEFAULT_ENVELOPE_CONTENT_COUNT = 0;

/**
 * The number of image contents allowed on a single envelope.
 *
 * 0 = Unlimited image contents.
 */
export const DEFAULT_ENVELOPE_CONTENT_IMAGE_COUNT = 0;
