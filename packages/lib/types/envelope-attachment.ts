import { z } from 'zod';

export const ZEnvelopeAttachmentTypeSchema = z.enum(['link']);

export type TEnvelopeAttachmentType = z.infer<typeof ZEnvelopeAttachmentTypeSchema>;
