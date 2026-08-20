import { ZFieldSchema } from '@documenso/lib/types/field';
import { ZEnvelopeFieldUpdateAndMetaSchema } from '@documenso/lib/types/field-meta';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc';
import { ZCoordinatePositionSchema } from './create-envelope-fields.types';

export const updateEnvelopeFieldsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/field/update-many',
    summary: 'Update envelope fields',
    description: 'Update multiple envelope fields for an envelope',
    tags: ['Envelope Fields'],
  },
};

// The update schema carries no create-time fieldMeta defaults: an omitted
// fieldMeta must arrive as undefined so the service leaves the stored
// configuration untouched instead of wiping it to type defaults (#3286).
const ZUpdateFieldBaseSchema = ZEnvelopeFieldUpdateAndMetaSchema.and(
  z.object({
    id: z.number().describe('The ID of the field to update.'),
    envelopeItemId: z
      .string()
      .optional()
      .describe(
        'The ID of the envelope item to put the field on. If not provided, field will be placed on the first item.',
      ),
  }),
);

// !: Later on we should support placeholders for updates, but since we didn't do the
// !: neccesary plumbing for updates in the initial release, we can hold off for now.
// const ZUpdateFieldSchema = z.union([
//   ZUpdateFieldBaseSchema.and(ZCoordinatePositionSchema),
//   ZUpdateFieldBaseSchema.and(ZPlaceholderPositionSchema),
// ]);

const ZUpdateFieldSchema = ZUpdateFieldBaseSchema.and(ZCoordinatePositionSchema.partial());

export const ZUpdateEnvelopeFieldsRequestSchema = z.object({
  envelopeId: z.string(),
  data: ZUpdateFieldSchema.array(),
});

export const ZUpdateEnvelopeFieldsResponseSchema = z.object({
  data: z.array(ZFieldSchema),
});

export type TUpdateEnvelopeFieldsRequest = z.infer<typeof ZUpdateEnvelopeFieldsRequestSchema>;
export type TUpdateEnvelopeFieldsResponse = z.infer<typeof ZUpdateEnvelopeFieldsResponseSchema>;
