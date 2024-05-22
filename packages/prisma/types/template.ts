import type {
  DocumentData,
  Field,
  Recipient,
  Template,
  TemplateDirectLink,
  TemplateMeta,
} from '@documenso/prisma/client';

export type TemplateWithData = Template & {
  templateDocumentData?: DocumentData | null;
  templateMeta?: TemplateMeta | null;
};

export type TemplateWithDetails = Template & {
  directLink: TemplateDirectLink | null;
  templateDocumentData: DocumentData;
  templateMeta: TemplateMeta | null;
  Recipient: Recipient[];
  Field: Field[];
};
