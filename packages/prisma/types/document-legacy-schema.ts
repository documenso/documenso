/**
 * Legacy Document schema to confirm backwards API compatibility since
 * we migrated Documents to Envelopes.
 */
import { z } from 'zod';

import { ZDocumentAuthOptionsSchema } from '@documenso/lib/types/document-auth';
import { ZDocumentFormValuesSchema } from '@documenso/lib/types/document-form-values';

import DocumentStatusSchema from '../generated/zod/inputTypeSchemas/DocumentStatusSchema';
import DocumentVisibilitySchema from '../generated/zod/inputTypeSchemas/DocumentVisibilitySchema';

const DocumentSourceSchema = z.enum(['DOCUMENT', 'TEMPLATE', 'TEMPLATE_DIRECT_LINK']);
const DocumentTypeSchema = z.enum(['DOCUMENT', 'PUBLIC_TEMPLATE', 'PRIVATE_TEMPLATE']);

/////////////////////////////////////////
// DOCUMENT SCHEMA
/////////////////////////////////////////

export const LegacyDocumentSchema = z.object({
  type: DocumentTypeSchema,
  visibility: DocumentVisibilitySchema,
  status: DocumentStatusSchema,
  source: DocumentSourceSchema,
  id: z.number(),
  qrToken: z
    .string()
    .describe('The token for viewing the document using the QR code on the certificate.')
    .nullable(),
  externalId: z
    .string()
    .describe('A custom external ID you can use to identify the document.')
    .nullable(),
  secondaryDocumentId: z.number(),
  secondaryTemplateId: z.number(),
  publicTitle: z.string(),
  publicDescription: z.string(),
  createdFromDocumentId: z.number().nullable(),
  userId: z.number().describe('The ID of the user that created this document.'),
  teamId: z.number(),
  /**
   * [DocumentAuthOptions]
   */
  authOptions: ZDocumentAuthOptionsSchema.nullable(),
  /**
   * [DocumentFormValues]
   */
  formValues: ZDocumentFormValuesSchema.nullable(),
  title: z.string(),
  documentDataId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  deletedAt: z.coerce.date().nullable(),
  useLegacyFieldInsertion: z.boolean(),
  folderId: z.string().nullable(),
});

export type Document = z.infer<typeof LegacyDocumentSchema>;
