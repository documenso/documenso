import { FieldType } from '@prisma/client';
import z from 'zod';

export const DETECTABLE_FIELD_TYPES = [
  FieldType.SIGNATURE,
  FieldType.INITIALS,
  FieldType.NAME,
  FieldType.EMAIL,
  FieldType.DATE,
  FieldType.TEXT,
  FieldType.NUMBER,
  FieldType.RADIO,
  FieldType.CHECKBOX,
] as const;

export const ZDetectableFieldType = z.enum(DETECTABLE_FIELD_TYPES);

export const ZConfidenceLevel = z.enum(['low', 'medium-low', 'medium', 'medium-high', 'high']);

export type TConfidenceLevel = z.infer<typeof ZConfidenceLevel>;

/**
 * Schema for a detected field's bounding box.
 * All values are normalized to a 0-1000 scale relative to the page dimensions.
 */
const ZBox2DSchema = z.array(z.number().min(0).max(1000)).length(4);

/**
 * Schema for a detected field.
 */
export const ZDetectedFieldSchema = z.object({
  type: ZDetectableFieldType.describe(
    `The field type based on nearby labels and visual appearance`,
  ),
  label: z
    .string()
    .describe(
      'For CHECKBOX and RADIO fields: combine a short plain-language summary of the question/topic with the option value using " - ". The prefix must describe WHAT the field is about — NOT just a question number (e.g., "Heart Disease History - Yes", "Heart Disease History - No", "Gender - Male", "Smoker - Yes", "Agreement - I Agree"). For all other fields: the form label printed near the field (e.g., "Social Security Number", "Date of Birth", "First Name", "Phone Number"). 3-8 words.',
    ),
  recipientKey: z
    .string()
    .describe(
      'Recipient identifier from nearby labels (e.g., "Tenant", "Landlord", "Buyer", "Seller"). Empty string if no recipient indicated.',
    ),
  box2d: ZBox2DSchema.describe(
    'Box2D [yMin, xMin, yMax, xMax] coordinates of the FILLABLE AREA only (exclude labels).',
  ),
  confidence: ZConfidenceLevel.describe('The confidence in the detection'),
});

export type DetectedField = z.infer<typeof ZDetectedFieldSchema>;

export const ZSubmitDetectedFieldsInputSchema = z.object({
  fields: z
    .array(ZDetectedFieldSchema)
    .describe('List of detected EMPTY fillable fields. Exclude pre-filled content and label text.'),
});

export type SubmitDetectedFieldsInput = z.infer<typeof ZSubmitDetectedFieldsInputSchema>;
