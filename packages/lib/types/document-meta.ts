import { msg } from '@lingui/core/macro';
import { z } from 'zod';

import { DocumentMetaSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentMetaSchema';

/**
 * The full document response schema.
 *
 * Mainly used for returning a single document from the API.
 */
export const ZDocumentMetaSchema = DocumentMetaSchema.pick({
  signingOrder: true,
  distributionMethod: true,
  id: true,
  subject: true,
  message: true,
  timezone: true,
  password: true,
  dateFormat: true,
  documentId: true,
  redirectUrl: true,
  typedSignatureEnabled: true,
  uploadSignatureEnabled: true,
  drawSignatureEnabled: true,
  language: true,
  emailSettings: true,
});

export type TDocumentMeta = z.infer<typeof ZDocumentMetaSchema>;

/**
 * If you update this, you must also update the schema.prisma @default value for
 * - Template meta
 * - Document meta
 */
export const ZDocumentSignatureSettingsSchema = z
  .object({
    typedSignatureEnabled: z.boolean(),
    uploadSignatureEnabled: z.boolean(),
    drawnSignatureEnabled: z.boolean(),
  })
  .refine(
    (data) => {
      return (
        data.typedSignatureEnabled || data.uploadSignatureEnabled || data.drawnSignatureEnabled
      );
    },
    {
      message: msg`At least one signature type must be enabled`.id,
    },
  );

export type TDocumentSignatureSettings = z.infer<typeof ZDocumentSignatureSettingsSchema>;
