import { Trans } from '@lingui/macro';
import { match } from 'ts-pattern';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import type { DocumentAndSender } from '@documenso/lib/server-only/document/get-document-by-token';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import type { CompletedField } from '@documenso/lib/types/fields';
import type { Field, Recipient } from '@documenso/prisma/client';
import { FieldType, RecipientRole } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';

import { DocumentReadOnlyFields } from '~/components/document/document-read-only-fields';

import { AutoSign } from './auto-sign';
import { CheckboxField } from './checkbox-field';
import { DateField } from './date-field';
import { DropdownField } from './dropdown-field';
import { EmailField } from './email-field';
import { SigningForm } from './form';
import { InitialsField } from './initials-field';
import { NameField } from './name-field';
import { NumberField } from './number-field';
import { RadioField } from './radio-field';
import { RejectDocumentDialog } from './reject-document-dialog';
import { SignatureField } from './signature-field';
import { TextField } from './text-field';

export type SigningPageViewProps = {
  document: DocumentAndSender;
  recipient: Recipient;
  fields: Field[];
  completedFields: CompletedField[];
  isRecipientsTurn: boolean;
};

export const SigningPageView = ({
  document,
  recipient,
  fields,
  completedFields,
  isRecipientsTurn,
}: SigningPageViewProps) => {
  const { documentData, documentMeta } = document;

  const shouldUseTeamDetails =
    document.teamId && document.team?.teamGlobalSettings?.includeSenderDetails === false;

  let senderName = document.User.name ?? '';
  let senderEmail = `(${document.User.email})`;

  if (shouldUseTeamDetails) {
    senderName = document.team?.name ?? '';
    senderEmail = document.team?.teamEmail?.email ? `(${document.team.teamEmail.email})` : '';
  }

  return (
    <div className="mx-auto w-full max-w-screen-xl">
      <h1
        className="mt-4 block max-w-[20rem] truncate text-2xl font-semibold md:max-w-[30rem] md:text-3xl"
        title={document.title}
      >
        {document.title}
      </h1>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-6">
        <div className="max-w-[50ch]">
          <span className="text-muted-foreground truncate" title={senderName}>
            {senderName} {senderEmail}
          </span>{' '}
          <span className="text-muted-foreground">
            {match(recipient.role)
              .with(RecipientRole.VIEWER, () =>
                document.teamId && !shouldUseTeamDetails ? (
                  <Trans>
                    on behalf of "{document.team?.name}" has invited you to view this document
                  </Trans>
                ) : (
                  <Trans>has invited you to view this document</Trans>
                ),
              )
              .with(RecipientRole.SIGNER, () =>
                document.teamId && !shouldUseTeamDetails ? (
                  <Trans>
                    on behalf of "{document.team?.name}" has invited you to sign this document
                  </Trans>
                ) : (
                  <Trans>has invited you to sign this document</Trans>
                ),
              )
              .with(RecipientRole.APPROVER, () =>
                document.teamId && !shouldUseTeamDetails ? (
                  <Trans>
                    on behalf of "{document.team?.name}" has invited you to approve this document
                  </Trans>
                ) : (
                  <Trans>has invited you to approve this document</Trans>
                ),
              )
              .otherwise(() => null)}
          </span>
        </div>

        <RejectDocumentDialog document={document} token={recipient.token} />
      </div>

      <div className="mt-8 grid grid-cols-12 gap-y-8 lg:gap-x-8 lg:gap-y-0">
        <Card
          className="col-span-12 rounded-xl before:rounded-xl lg:col-span-7 xl:col-span-8"
          gradient
        >
          <CardContent className="p-2">
            <LazyPDFViewer
              key={documentData.id}
              documentData={documentData}
              document={document}
              password={documentMeta?.password}
            />
          </CardContent>
        </Card>

        <div className="col-span-12 lg:col-span-5 xl:col-span-4">
          <SigningForm
            document={document}
            recipient={recipient}
            fields={fields}
            redirectUrl={documentMeta?.redirectUrl}
            isRecipientsTurn={isRecipientsTurn}
          />
        </div>
      </div>

      <DocumentReadOnlyFields fields={completedFields} />

      <AutoSign recipient={recipient} fields={fields} />

      <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
        {fields.map((field) =>
          match(field.type)
            .with(FieldType.SIGNATURE, () => (
              <SignatureField
                key={field.id}
                field={field}
                recipient={recipient}
                typedSignatureEnabled={documentMeta?.typedSignatureEnabled}
              />
            ))
            .with(FieldType.INITIALS, () => (
              <InitialsField key={field.id} field={field} recipient={recipient} />
            ))
            .with(FieldType.NAME, () => (
              <NameField key={field.id} field={field} recipient={recipient} />
            ))
            .with(FieldType.DATE, () => (
              <DateField
                key={field.id}
                field={field}
                recipient={recipient}
                dateFormat={documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT}
                timezone={documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE}
              />
            ))
            .with(FieldType.EMAIL, () => (
              <EmailField key={field.id} field={field} recipient={recipient} />
            ))
            .with(FieldType.TEXT, () => {
              const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                ...field,
                fieldMeta: field.fieldMeta ? ZTextFieldMeta.parse(field.fieldMeta) : null,
              };
              return <TextField key={field.id} field={fieldWithMeta} recipient={recipient} />;
            })
            .with(FieldType.NUMBER, () => {
              const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                ...field,
                fieldMeta: field.fieldMeta ? ZNumberFieldMeta.parse(field.fieldMeta) : null,
              };
              return <NumberField key={field.id} field={fieldWithMeta} recipient={recipient} />;
            })
            .with(FieldType.RADIO, () => {
              const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                ...field,
                fieldMeta: field.fieldMeta ? ZRadioFieldMeta.parse(field.fieldMeta) : null,
              };
              return <RadioField key={field.id} field={fieldWithMeta} recipient={recipient} />;
            })
            .with(FieldType.CHECKBOX, () => {
              const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                ...field,
                fieldMeta: field.fieldMeta ? ZCheckboxFieldMeta.parse(field.fieldMeta) : null,
              };
              return <CheckboxField key={field.id} field={fieldWithMeta} recipient={recipient} />;
            })
            .with(FieldType.DROPDOWN, () => {
              const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                ...field,
                fieldMeta: field.fieldMeta ? ZDropdownFieldMeta.parse(field.fieldMeta) : null,
              };
              return <DropdownField key={field.id} field={fieldWithMeta} recipient={recipient} />;
            })
            .otherwise(() => null),
        )}
      </ElementVisible>
    </div>
  );
};
