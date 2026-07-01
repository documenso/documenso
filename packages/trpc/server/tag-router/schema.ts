import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { ZTagTypeSchema } from '@documenso/lib/types/tag-type';
import TagSchema from '@documenso/prisma/generated/zod/modelSchema/TagSchema';
import { z } from 'zod';

export const ZTagSchema = TagSchema.pick({
  id: true,
  name: true,
  type: true,
  teamId: true,
  createdAt: true,
  updatedAt: true,
});

export type TTag = z.infer<typeof ZTagSchema>;

export const ZCreateTagRequestSchema = z.object({
  name: z.string().min(1).max(50),
  type: ZTagTypeSchema,
});

export const ZCreateTagResponseSchema = ZTagSchema;

export const ZUpdateTagRequestSchema = z.object({
  tagId: z.string().describe('The ID of the tag to update'),
  data: z.object({
    name: z.string().min(1).max(50).optional().describe('The name of the tag'),
  }),
});

export const ZUpdateTagResponseSchema = ZTagSchema;

export const ZDeleteTagRequestSchema = z.object({
  tagId: z.string(),
});

export const ZFindTagsRequestSchema = ZFindSearchParamsSchema.extend({
  type: ZTagTypeSchema.optional().describe('Filter tags by type'),
  query: z.string().optional().describe('Search tags by name'),
});

export const ZFindTagsResponseSchema = ZFindResultResponse.extend({
  data: z.array(ZTagSchema),
});

export const ZSetEnvelopeTagsRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope to assign tags to'),
  tagIds: z.array(z.string()).describe('The tag IDs to assign to the envelope'),
});

export const ZSetEnvelopeTagsResponseSchema = z.array(ZTagSchema);

export const ZGetEnvelopeTagsRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope to get tags for'),
});

export const ZGetEnvelopeTagsResponseSchema = z.array(ZTagSchema);

export type TFindTagsResponse = z.infer<typeof ZFindTagsResponseSchema>;
export type TSetEnvelopeTagsResponse = z.infer<typeof ZSetEnvelopeTagsResponseSchema>;
export type TGetEnvelopeTagsResponse = z.infer<typeof ZGetEnvelopeTagsResponseSchema>;
