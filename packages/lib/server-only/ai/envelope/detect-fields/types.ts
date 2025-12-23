import type { Recipient } from '@prisma/client';

import type { DETECTABLE_FIELD_TYPES, TConfidenceLevel } from './schema';

export type DetectableFieldType = (typeof DETECTABLE_FIELD_TYPES)[number];

/**
 * Normalized field position using 0-100 percentage scale (matching Field model).
 */
export type NormalizedField = {
  type: DetectableFieldType;
  recipientKey: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  confidence: TConfidenceLevel;
};

export type RecipientContext = Pick<Recipient, 'id' | 'name' | 'email'>;

export type NormalizedFieldWithPage = NormalizedField & {
  pageNumber: number;
};

export type NormalizedFieldWithContext = Omit<NormalizedField, 'recipientKey'> & {
  pageNumber: number;
  envelopeItemId: string;
  recipientId: number;
};
