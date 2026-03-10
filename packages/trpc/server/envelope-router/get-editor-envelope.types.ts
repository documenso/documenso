import { z } from 'zod';

import { ZEditorEnvelopeSchema } from '@documenso/lib/types/envelope-editor';

export const ZGetEditorEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
});

export const ZGetEditorEnvelopeResponseSchema = ZEditorEnvelopeSchema;

export type TGetEditorEnvelopeRequest = z.infer<typeof ZGetEditorEnvelopeRequestSchema>;
export type TGetEditorEnvelopeResponse = z.infer<typeof ZGetEditorEnvelopeResponseSchema>;
