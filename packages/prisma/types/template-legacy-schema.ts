/**
 * Legacy Template schema to confirm backwards API compatibility since
 * we removed the "Template" prisma schema model.
 */
import { TemplateType } from '@prisma/client';
import { z } from 'zod';

import { ZDocumentAuthOptionsSchema } from '@documenso/lib/types/document-auth';

import { DocumentVisibilitySchema } from '../generated/zod/inputTypeSchemas/DocumentVisibilitySchema';
import TemplateDirectLinkSchema from '../generated/zod/modelSchema/TemplateDirectLinkSchema';

export const TemplateTypeSchema = z.nativeEnum(TemplateType);

export const TemplateSchema = z.object({
  type: TemplateTypeSchema,
  visibility: DocumentVisibilitySchema,
  id: z.number(),
  externalId: z.string().nullable(),
  title: z.string(),
  /**
   * [DocumentAuthOptions]
   */
  authOptions: ZDocumentAuthOptionsSchema.nullable(),
  templateDocumentDataId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  publicTitle: z.string(),
  publicDescription: z.string(),
  useLegacyFieldInsertion: z.boolean(),
  userId: z.number(),
  teamId: z.number(),
  folderId: z.string().nullable(),
});

export type Template = z.infer<typeof TemplateSchema>;

export const LegacyTemplateDirectLinkSchema = TemplateDirectLinkSchema.extend({
  templateId: z.number(),
});
