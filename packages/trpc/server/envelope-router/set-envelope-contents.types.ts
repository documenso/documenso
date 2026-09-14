import { ZEnvelopeContentInternalSchema } from '@documenso/lib/types/envelope-content';
import { ZContentZIndexSchema, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { z } from 'zod';

export const ZSetEnvelopeContentsRequestSchema = z.object({
  envelopeId: z.string(),
  contents: z.array(
    z.object({
      id: z.string().optional().describe('The id of the content. If not provided, a new content will be created.'),
      formId: z.string().optional().describe('A temporary ID to keep track of new contents created'),
      envelopeItemId: z.string().describe('The id of the envelope item to put the content on'),
      metadata: ZEnvelopeContentMetaSchema,
      dataContentId: z
        .string()
        .nullish()
        .describe('The id of an uploaded data content (e.g. an image) to attach. Omit or null to detach.'),
      zIndex: ZContentZIndexSchema.optional().describe(
        'The stacking order among the contents of the page, higher on top. Defaults to above every other content.',
      ),
    }),
  ),
});

export const ZSetEnvelopeContentsResponseSchema = z.object({
  data: ZEnvelopeContentInternalSchema.extend({
    formId: z.string().optional(),
  }).array(),
});

export type TSetEnvelopeContentsRequest = z.infer<typeof ZSetEnvelopeContentsRequestSchema>;
export type TSetEnvelopeContentsResponse = z.infer<typeof ZSetEnvelopeContentsResponseSchema>;
