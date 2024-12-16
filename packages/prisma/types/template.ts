import type { TGetTemplateByIdResponse } from '@documenso/lib/server-only/template/get-template-by-id';
import type { DocumentData, Template, TemplateMeta } from '@documenso/prisma/client';

export type TemplateWithData = Template & {
  templateDocumentData?: DocumentData | null;
  templateMeta?: TemplateMeta | null;
};

export type TemplateWithDetails = TGetTemplateByIdResponse;
