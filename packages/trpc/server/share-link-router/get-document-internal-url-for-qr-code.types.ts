import { z } from 'zod';

export const ZGetDocumentInternalUrlForQRCodeInput = z.object({
  documentId: z.number(),
});

export type TGetDocumentInternalUrlForQRCodeInput = z.infer<
  typeof ZGetDocumentInternalUrlForQRCodeInput
>;

export const ZGetDocumentInternalUrlForQRCodeOutput = z.string().nullable();

export type TGetDocumentInternalUrlForQRCodeOutput = z.infer<
  typeof ZGetDocumentInternalUrlForQRCodeOutput
>;
