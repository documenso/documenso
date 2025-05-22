import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { FieldType, RecipientRole } from '@prisma/client';
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
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';
import { DocumentReadOnlyFields } from '@documenso/ui/components/document/document-read-only-fields';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { PDFViewer } from '@documenso/ui/primitives/pdf-viewer';

import { DocumentSigningAutoSign } from '~/components/general/document-signing/document-signing-auto-sign';
import { DocumentSigningCheckboxField } from '~/components/general/document-signing/document-signing-checkbox-field';
import { DocumentSigningDateField } from '~/components/general/document-signing/document-signing-date-field';
import { DocumentSigningDropdownField } from '~/components/general/document-signing/document-signing-dropdown-field';
import { DocumentSigningEmailField } from '~/components/general/document-signing/document-signing-email-field';
import { DocumentSigningForm } from '~/components/general/document-signing/document-signing-form';
import { DocumentSigningInitialsField } from '~/components/general/document-signing/document-signing-initials-field';
import { DocumentSigningNameField } from '~/components/general/document-signing/document-signing-name-field';
import { DocumentSigningNumberField } from '~/components/general/document-signing/document-signing-number-field';
import { DocumentSigningRadioField } from '~/components/general/document-signing/document-signing-radio-field';
import { DocumentSigningRejectDialog } from '~/components/general/document-signing/document-signing-reject-dialog';
import { DocumentSigningSignatureField } from '~/components/general/document-signing/document-signing-signature-field';
import { DocumentSigningTextField } from '~/components/general/document-signing/document-signing-text-field';

import { DocumentSigningRecipientProvider } from './document-signing-recipient-provider';

export type DocumentSigningPageViewProps = {
  recipient: RecipientWithFields;
  document: DocumentAndSender;
  fields: Field[];
  completedFields: CompletedField[];
  isRecipientsTurn: boolean;
  allRecipients?: RecipientWithFields[];
  includeSenderDetails: boolean;
};

export const DocumentSigningPageView = ({
  recipient,
  document,
  fields,
  completedFields,
  isRecipientsTurn,
  allRecipients = [],
  includeSenderDetails,
}: DocumentSigningPageViewProps) => {
  const { documentData, documentMeta } = document;

  const [selectedSignerId, setSelectedSignerId] = useState<number | null>(allRecipients?.[0]?.id);

  let senderName = document.user.name ?? '';
  let senderEmail = `(${document.user.email})`;

  if (includeSenderDetails) {
    senderName = document.team?.name ?? '';
    senderEmail = document.team?.teamEmail?.email ? `(${document.team.teamEmail.email})` : '';
  }

  const selectedSigner = allRecipients?.find((r) => r.id === selectedSignerId);

  return (
    <DocumentSigningRecipientProvider recipient={recipient} targetSigner={selectedSigner ?? null}>
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
                  includeSenderDetails ? (
                    <Trans>
                      on behalf of "{document.team?.name}" has invited you to view this document
                    </Trans>
                  ) : (
                    <Trans>has invited you to view this document</Trans>
                  ),
                )
                .with(RecipientRole.SIGNER, () =>
                  includeSenderDetails ? (
                    <Trans>
                      on behalf of "{document.team?.name}" has invited you to sign this document
                    </Trans>
                  ) : (
                    <Trans>has invited you to sign this document</Trans>
                  ),
                )
                .with(RecipientRole.APPROVER, () =>
                  includeSenderDetails ? (
                    <Trans>
                      on behalf of "{document.team?.name}" has invited you to approve this document
                    </Trans>
                  ) : (
                    <Trans>has invited you to approve this document</Trans>
                  ),
                )
                .with(RecipientRole.ASSISTANT, () =>
                  includeSenderDetails ? (
                    <Trans>
                      on behalf of "{document.team?.name}" has invited you to assist this document
                    </Trans>
                  ) : (
                    <Trans>has invited you to assist this document</Trans>
                  ),
                )
                .otherwise(() => null)}
            </span>
          </div>

          <DocumentSigningRejectDialog document={document} token={recipient.token} />
        </div>

        <div className="mt-8 grid grid-cols-12 gap-y-8 lg:gap-x-8 lg:gap-y-0">
          <Card
            className="col-span-12 rounded-xl before:rounded-xl lg:col-span-7 xl:col-span-8"
            gradient
          >
            <CardContent className="p-2">
              <PDFViewer key={documentData.id} documentData={documentData} document={document} />
            </CardContent>
          </Card>

          <div className="col-span-12 lg:col-span-5 xl:col-span-4">
            <DocumentSigningForm
              document={document}
              recipient={recipient}
              fields={fields}
              redirectUrl={documentMeta?.redirectUrl}
              isRecipientsTurn={isRecipientsTurn}
              allRecipients={allRecipients}
              setSelectedSignerId={setSelectedSignerId}
            />
          </div>
        </div>

        <DocumentReadOnlyFields
          documentMeta={documentMeta || undefined}
          fields={completedFields}
          showRecipientTooltip={true}
        />

        {recipient.role !== RecipientRole.ASSISTANT && (
          <DocumentSigningAutoSign recipient={recipient} fields={fields} />
        )}

        <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
          {fields
            .filter(
              (field) =>
                recipient.role !== RecipientRole.ASSISTANT ||
                field.recipientId === selectedSigner?.id,
            )
            .map((field) =>
              match(field.type)
                .with(FieldType.SIGNATURE, () => (
                  <DocumentSigningSignatureField
                    key={field.id}
                    field={field}
                    typedSignatureEnabled={documentMeta?.typedSignatureEnabled}
                    uploadSignatureEnabled={documentMeta?.uploadSignatureEnabled}
                    drawSignatureEnabled={documentMeta?.drawSignatureEnabled}
                  />
                ))
                .with(FieldType.INITIALS, () => (
                  <DocumentSigningInitialsField key={field.id} field={field} />
                ))
                .with(FieldType.NAME, () => (
                  <DocumentSigningNameField key={field.id} field={field} />
                ))
                .with(FieldType.DATE, () => (
                  <DocumentSigningDateField
                    key={field.id}
                    field={field}
                    dateFormat={documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT}
                    timezone={documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE}
                  />
                ))
                .with(FieldType.EMAIL, () => (
                  <DocumentSigningEmailField key={field.id} field={field} />
                ))
                .with(FieldType.TEXT, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZTextFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <DocumentSigningTextField key={field.id} field={fieldWithMeta} />;
                })
                .with(FieldType.NUMBER, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZNumberFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <DocumentSigningNumberField key={field.id} field={fieldWithMeta} />;
                })
                .with(FieldType.RADIO, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZRadioFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <DocumentSigningRadioField key={field.id} field={fieldWithMeta} />;
                })
                .with(FieldType.CHECKBOX, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZCheckboxFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <DocumentSigningCheckboxField key={field.id} field={fieldWithMeta} />;
                })
                .with(FieldType.DROPDOWN, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZDropdownFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <DocumentSigningDropdownField key={field.id} field={fieldWithMeta} />;
                })
                .otherwise(() => null),
            )}
        </ElementVisible>
      </div>
    </DocumentSigningRecipientProvider>
  );
};
