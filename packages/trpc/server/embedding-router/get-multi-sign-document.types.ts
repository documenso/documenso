import { z } from 'zod';

import { ZDocumentLiteSchema } from '@documenso/lib/types/document';
import { ZRecipientLiteSchema } from '@documenso/lib/types/recipient';
import DocumentDataSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentDataSchema';
import DocumentMetaSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentMetaSchema';
import FieldSchema from '@documenso/prisma/generated/zod/modelSchema/FieldSchema';
import SignatureSchema from '@documenso/prisma/generated/zod/modelSchema/SignatureSchema';

export const ZGetMultiSignDocumentRequestSchema = z.object({
  token: z.string().min(1, { message: 'Token is required' }),
});

export const ZGetMultiSignDocumentResponseSchema = ZDocumentLiteSchema.extend({
  documentData: DocumentDataSchema.pick({
    type: true,
    id: true,
    data: true,
    initialData: true,
  }),
  documentMeta: DocumentMetaSchema.pick({
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
    allowDictateNextSigner: true,
    language: true,
    emailSettings: true,
  }).nullable(),
  fields: z.array(
    FieldSchema.extend({
      recipient: ZRecipientLiteSchema,
      signature: SignatureSchema.nullable(),
    }),
  ),
});

export type TGetMultiSignDocumentRequestSchema = z.infer<typeof ZGetMultiSignDocumentRequestSchema>;
export type TGetMultiSignDocumentResponseSchema = z.infer<
  typeof ZGetMultiSignDocumentResponseSchema
>;
