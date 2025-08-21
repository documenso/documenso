import type { DocumentMeta } from '@prisma/client';
import { type Field, FieldType } from '@prisma/client';
import { match } from 'ts-pattern';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';

import { DocumentSigningCheckboxField } from '~/components/general/document-signing/document-signing-checkbox-field';
import { DocumentSigningDateField } from '~/components/general/document-signing/document-signing-date-field';
import { DocumentSigningDropdownField } from '~/components/general/document-signing/document-signing-dropdown-field';
import { DocumentSigningEmailField } from '~/components/general/document-signing/document-signing-email-field';
import { DocumentSigningInitialsField } from '~/components/general/document-signing/document-signing-initials-field';
import { DocumentSigningNameField } from '~/components/general/document-signing/document-signing-name-field';
import { DocumentSigningNumberField } from '~/components/general/document-signing/document-signing-number-field';
import { DocumentSigningRadioField } from '~/components/general/document-signing/document-signing-radio-field';
import { DocumentSigningSignatureField } from '~/components/general/document-signing/document-signing-signature-field';
import { DocumentSigningTextField } from '~/components/general/document-signing/document-signing-text-field';

export type EmbedDocumentFieldsProps = {
  fields: Field[];
  metadata?: Pick<
    DocumentMeta,
    | 'timezone'
    | 'dateFormat'
    | 'typedSignatureEnabled'
    | 'uploadSignatureEnabled'
    | 'drawSignatureEnabled'
  > | null;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const EmbedDocumentFields = ({
  fields,
  metadata,
  onSignField,
  onUnsignField,
}: EmbedDocumentFieldsProps) => {
  const highestPageNumber = Math.max(...fields.map((field) => field.page));

  return (
    <ElementVisible target={`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${highestPageNumber}"]`}>
      {fields.map((field) =>
        match(field.type)
          .with(FieldType.SIGNATURE, () => (
            <DocumentSigningSignatureField
              key={field.id}
              field={field}
              onSignField={onSignField}
              onUnsignField={onUnsignField}
              typedSignatureEnabled={metadata?.typedSignatureEnabled}
              uploadSignatureEnabled={metadata?.uploadSignatureEnabled}
              drawSignatureEnabled={metadata?.drawSignatureEnabled}
            />
          ))
          .with(FieldType.INITIALS, () => (
            <DocumentSigningInitialsField
              key={field.id}
              field={field}
              onSignField={onSignField}
              onUnsignField={onUnsignField}
            />
          ))
          .with(FieldType.NAME, () => (
            <DocumentSigningNameField
              key={field.id}
              field={field}
              onSignField={onSignField}
              onUnsignField={onUnsignField}
            />
          ))
          .with(FieldType.DATE, () => (
            <DocumentSigningDateField
              key={field.id}
              field={field}
              onSignField={onSignField}
              onUnsignField={onUnsignField}
              dateFormat={metadata?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT}
              timezone={metadata?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE}
            />
          ))
          .with(FieldType.EMAIL, () => (
            <DocumentSigningEmailField
              key={field.id}
              field={field}
              onSignField={onSignField}
              onUnsignField={onUnsignField}
            />
          ))
          .with(FieldType.TEXT, () => {
            const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
              ...field,
              fieldMeta: field.fieldMeta ? ZTextFieldMeta.parse(field.fieldMeta) : null,
            };

            return (
              <DocumentSigningTextField
                key={field.id}
                field={fieldWithMeta}
                onSignField={onSignField}
                onUnsignField={onUnsignField}
              />
            );
          })
          .with(FieldType.NUMBER, () => {
            const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
              ...field,
              fieldMeta: field.fieldMeta ? ZNumberFieldMeta.parse(field.fieldMeta) : null,
            };

            return (
              <DocumentSigningNumberField
                key={field.id}
                field={fieldWithMeta}
                onSignField={onSignField}
                onUnsignField={onUnsignField}
              />
            );
          })
          .with(FieldType.RADIO, () => {
            const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
              ...field,
              fieldMeta: field.fieldMeta ? ZRadioFieldMeta.parse(field.fieldMeta) : null,
            };

            return (
              <DocumentSigningRadioField
                key={field.id}
                field={fieldWithMeta}
                onSignField={onSignField}
                onUnsignField={onUnsignField}
              />
            );
          })
          .with(FieldType.CHECKBOX, () => {
            const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
              ...field,
              fieldMeta: field.fieldMeta ? ZCheckboxFieldMeta.parse(field.fieldMeta) : null,
            };

            return (
              <DocumentSigningCheckboxField
                key={field.id}
                field={fieldWithMeta}
                onSignField={onSignField}
                onUnsignField={onUnsignField}
              />
            );
          })
          .with(FieldType.DROPDOWN, () => {
            const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
              ...field,
              fieldMeta: field.fieldMeta ? ZDropdownFieldMeta.parse(field.fieldMeta) : null,
            };

            return (
              <DocumentSigningDropdownField
                key={field.id}
                field={fieldWithMeta}
                onSignField={onSignField}
                onUnsignField={onUnsignField}
              />
            );
          })
          .otherwise(() => null),
      )}
    </ElementVisible>
  );
};
