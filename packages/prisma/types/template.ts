import type {
  DocumentData,
  Field,
  Recipient,
  Template,
  TemplateDirectAccess,
  TemplateMeta,
} from '@documenso/prisma/client';

export type TemplateWithData = Template & {
  templateDocumentData?: DocumentData | null;
  templateMeta?: TemplateMeta | null;
};

export type TemplateWithDetails = Template & {
  access: TemplateDirectAccess | null;
  templateDocumentData: DocumentData;
  templateMeta: TemplateMeta | null;
  Recipient: Recipient[];
  Field: Field[];
};
