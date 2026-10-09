import { ZDataContentImageMeta } from '@documenso/lib/types/data-content-meta';
import { ZEnvelopeContentSchema } from '@documenso/lib/types/envelope-content';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

import { zfdContentImageFile, zodFormData } from '../../utils/zod-form-data';

export const ZUploadEnvelopeContentImagePayloadSchema = z.object({
  envelopeId: z.string(),
  envelopeContentId: z.string().describe('The id of the image content to attach the image to.'),
});

export const ZUploadEnvelopeContentImageRequestSchema = zodFormData({
  payload: zfd.json(ZUploadEnvelopeContentImagePayloadSchema),
  file: zfdContentImageFile(),
});

export const ZUploadEnvelopeContentImageResponseSchema = z.object({
  content: ZEnvelopeContentSchema,
  dataContent: z.object({
    id: z.string(),
    metadata: ZDataContentImageMeta,
  }),
});

export type TUploadEnvelopeContentImagePayload = z.infer<typeof ZUploadEnvelopeContentImagePayloadSchema>;
export type TUploadEnvelopeContentImageResponse = z.infer<typeof ZUploadEnvelopeContentImageResponseSchema>;
