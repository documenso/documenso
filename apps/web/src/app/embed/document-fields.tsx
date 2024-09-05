'use client';

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
import type { DocumentMeta, Recipient, TemplateMeta } from '@documenso/prisma/client';
import { FieldType, type Field } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';

import { CheckboxField } from '~/app/(signing)/sign/[token]/checkbox-field';
import { DateField } from '~/app/(signing)/sign/[token]/date-field';
import { DropdownField } from '~/app/(signing)/sign/[token]/dropdown-field';
import { EmailField } from '~/app/(signing)/sign/[token]/email-field';
import { InitialsField } from '~/app/(signing)/sign/[token]/initials-field';
import { NameField } from '~/app/(signing)/sign/[token]/name-field';
import { NumberField } from '~/app/(signing)/sign/[token]/number-field';
import { RadioField } from '~/app/(signing)/sign/[token]/radio-field';
import { SignatureField } from '~/app/(signing)/sign/[token]/signature-field';
import { TextField } from '~/app/(signing)/sign/[token]/text-field';

export type EmbedDocumentFieldsProps = {
  recipient: Recipient;
  fields: Field[];
  metadata?: DocumentMeta | TemplateMeta | null;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const EmbedDocumentFields = ({
  recipient,
  fields,
  metadata,
  onSignField,
  onUnsignField,
}: EmbedDocumentFieldsProps) => {
  return (
    <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
      {fields.map((field) =>
        match(field.type)
          .with(FieldType.SIGNATURE, () => (
            <SignatureField
              key={field.id}
              field={field}
              recipient={recipient}
              onSignField={onSignField}
              onUnsignField={onUnsignField}
            />
          ))
          .with(FieldType.INITIALS, () => (
            <InitialsField
              key={field.id}
              field={field}
              recipient={recipient}
              onSignField={onSignField}
              onUnsignField={onUnsignField}
            />
          ))
          .with(FieldType.NAME, () => (
            <NameField
              key={field.id}
              field={field}
              recipient={recipient}
              onSignField={onSignField}
              onUnsignField={onUnsignField}
            />
          ))
          .with(FieldType.DATE, () => (
            <DateField
              key={field.id}
              field={field}
              recipient={recipient}
              onSignField={onSignField}
              onUnsignField={onUnsignField}
              dateFormat={metadata?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT}
              timezone={metadata?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE}
            />
          ))
          .with(FieldType.EMAIL, () => (
            <EmailField
              key={field.id}
              field={field}
              recipient={recipient}
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
              <TextField
                key={field.id}
                field={fieldWithMeta}
                recipient={recipient}
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
              <NumberField
                key={field.id}
                field={fieldWithMeta}
                recipient={recipient}
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
              <RadioField
                key={field.id}
                field={fieldWithMeta}
                recipient={recipient}
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
              <CheckboxField
                key={field.id}
                field={fieldWithMeta}
                recipient={recipient}
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
              <DropdownField
                key={field.id}
                field={fieldWithMeta}
                recipient={recipient}
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
