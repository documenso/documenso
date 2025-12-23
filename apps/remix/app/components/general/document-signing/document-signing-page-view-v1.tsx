import { useMemo, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { FieldType, RecipientRole } from '@prisma/client';
import { LucideChevronDown, LucideChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router';
import { P, match } from 'ts-pattern';

import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import type { DocumentAndSender } from '@documenso/lib/server-only/document/get-document-by-token';
import type { TRecipientAccessAuth } from '@documenso/lib/types/document-auth';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import type { CompletedField } from '@documenso/lib/types/fields';
import { isFieldUnsignedAndRequired } from '@documenso/lib/utils/advanced-fields-helpers';
import { validateFieldsInserted } from '@documenso/lib/utils/fields';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';
import { trpc } from '@documenso/trpc/react';
import { DocumentReadOnlyFields } from '@documenso/ui/components/document/document-read-only-fields';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { PDFViewerLazy } from '@documenso/ui/primitives/pdf-viewer/lazy';

import { DocumentSigningAttachmentsPopover } from '~/components/general/document-signing/document-signing-attachments-popover';
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

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningCompleteDialog } from './document-signing-complete-dialog';
import { DocumentSigningRecipientProvider } from './document-signing-recipient-provider';

export type DocumentSigningPageViewV1Props = {
  recipient: RecipientWithFields;
  document: DocumentAndSender;
  fields: Field[];
  completedFields: CompletedField[];
  isRecipientsTurn: boolean;
  allRecipients?: RecipientWithFields[];
  includeSenderDetails: boolean;
};

export const DocumentSigningPageViewV1 = ({
  recipient,
  document,
  fields,
  completedFields,
  isRecipientsTurn,
  allRecipients = [],
  includeSenderDetails,
}: DocumentSigningPageViewV1Props) => {
  const { documentData, documentMeta } = document;

  const { derivedRecipientAccessAuth, user: authUser } = useRequiredDocumentSigningAuthContext();

  const hasAuthenticator = authUser?.twoFactorEnabled
    ? authUser.twoFactorEnabled && authUser.email === recipient.email
    : false;

  const navigate = useNavigate();
  const analytics = useAnalytics();

  const [selectedSignerId, setSelectedSignerId] = useState<number | null>(allRecipients?.[0]?.id);
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    mutateAsync: completeDocumentWithToken,
    isPending,
    isSuccess,
  } = trpc.recipient.completeDocumentWithToken.useMutation();

  // Keep the loading state going if successful since the redirect may take some time.
  const isSubmitting = isPending || isSuccess;

  const fieldsRequiringValidation = useMemo(
    () => fields.filter(isFieldUnsignedAndRequired),
    [fields],
  );

  const fieldsValidated = () => {
    validateFieldsInserted(fieldsRequiringValidation);
  };

  const completeDocument = async (options: {
    accessAuthOptions?: TRecipientAccessAuth;
    nextSigner?: { email: string; name: string };
  }) => {
    const { accessAuthOptions, nextSigner } = options;

    const payload = {
      token: recipient.token,
      documentId: document.id,
      accessAuthOptions,
      ...(nextSigner?.email && nextSigner?.name ? { nextSigner } : {}),
    };

    await completeDocumentWithToken(payload);

    analytics.capture('App: Recipient has completed signing', {
      signerId: recipient.id,
      documentId: document.id,
      timestamp: new Date().toISOString(),
    });

    if (documentMeta?.redirectUrl) {
      window.location.href = documentMeta.redirectUrl;
    } else {
      await navigate(`/sign/${recipient.token}/complete`);
    }
  };

  let senderName = document.user.name ?? '';
  let senderEmail = `(${document.user.email})`;

  if (includeSenderDetails) {
    senderName = document.team?.name ?? '';
    senderEmail = document.team?.teamEmail?.email ? `(${document.team.teamEmail.email})` : '';
  }

  const selectedSigner = allRecipients?.find((r) => r.id === selectedSignerId);
  const targetSigner =
    recipient.role === RecipientRole.ASSISTANT && selectedSigner ? selectedSigner : null;

  const nextRecipient = useMemo(() => {
    if (!documentMeta?.signingOrder || documentMeta.signingOrder !== 'SEQUENTIAL') {
      return undefined;
    }

    const sortedRecipients = allRecipients.sort((a, b) => {
      // Sort by signingOrder first (nulls last), then by id
      if (a.signingOrder === null && b.signingOrder === null) return a.id - b.id;
      if (a.signingOrder === null) return 1;
      if (b.signingOrder === null) return -1;
      if (a.signingOrder === b.signingOrder) return a.id - b.id;
      return a.signingOrder - b.signingOrder;
    });

    const currentIndex = sortedRecipients.findIndex((r) => r.id === recipient.id);
    return currentIndex !== -1 && currentIndex < sortedRecipients.length - 1
      ? sortedRecipients[currentIndex + 1]
      : undefined;
  }, [document.documentMeta?.signingOrder, allRecipients, recipient.id]);

  const highestPageNumber = Math.max(...fields.map((field) => field.page));

  const pendingFields = fieldsRequiringValidation.filter((field) => !field.inserted);
  const hasPendingFields = pendingFields.length > 0;

  return (
    <DocumentSigningRecipientProvider recipient={recipient} targetSigner={targetSigner}>
      <div className="mx-auto w-full max-w-screen-xl sm:px-6">
        {document.team.teamGlobalSettings.brandingEnabled &&
          document.team.teamGlobalSettings.brandingLogo && (
            <img
              src={`/api/branding/logo/team/${document.teamId}`}
              alt={`${document.team.name}'s Logo`}
              className="mb-4 h-12 w-12 md:mb-2"
            />
          )}
        <h1
          className="block max-w-[20rem] truncate text-2xl font-semibold sm:mt-4 md:max-w-[30rem] md:text-3xl"
          title={document.title}
        >
          {document.title}
        </h1>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-y-2 sm:mt-2.5 sm:gap-y-0">
          <div className="max-w-[50ch]">
            <span className="text-muted-foreground">
              {match(recipient.role)
                .with(RecipientRole.VIEWER, () =>
                  includeSenderDetails ? (
                    <Trans>
                      <span className="truncate" title={senderName}>
                        {senderName} {senderEmail}
                      </span>{' '}
                      on behalf of "{document.team?.name}" has invited you to view this document
                    </Trans>
                  ) : (
                    <Trans>
                      <span className="truncate" title={senderName}>
                        {senderName} {senderEmail}
                      </span>{' '}
                      has invited you to view this document
                    </Trans>
                  ),
                )
                .with(RecipientRole.SIGNER, () =>
                  includeSenderDetails ? (
                    <Trans>
                      <span className="truncate" title={senderName}>
                        {senderName} {senderEmail}
                      </span>{' '}
                      on behalf of "{document.team?.name}" has invited you to sign this document
                    </Trans>
                  ) : (
                    <Trans>
                      <span className="truncate" title={senderName}>
                        {senderName} {senderEmail}
                      </span>{' '}
                      has invited you to sign this document
                    </Trans>
                  ),
                )
                .with(RecipientRole.APPROVER, () =>
                  includeSenderDetails ? (
                    <Trans>
                      <span className="truncate" title={senderName}>
                        {senderName} {senderEmail}
                      </span>{' '}
                      on behalf of "{document.team?.name}" has invited you to approve this document
                    </Trans>
                  ) : (
                    <Trans>
                      <span className="truncate" title={senderName}>
                        {senderName} {senderEmail}
                      </span>{' '}
                      has invited you to approve this document
                    </Trans>
                  ),
                )
                .with(RecipientRole.ASSISTANT, () =>
                  includeSenderDetails ? (
                    <Trans>
                      <span className="truncate" title={senderName}>
                        {senderName} {senderEmail}
                      </span>{' '}
                      on behalf of "{document.team?.name}" has invited you to assist this document
                    </Trans>
                  ) : (
                    <Trans>
                      <span className="truncate" title={senderName}>
                        {senderName} {senderEmail}
                      </span>{' '}
                      has invited you to assist this document
                    </Trans>
                  ),
                )
                .otherwise(() => null)}
            </span>
          </div>

          <div className="flex items-center gap-x-4">
            <DocumentSigningAttachmentsPopover
              envelopeId={document.envelopeId}
              token={recipient.token}
            />
            <DocumentSigningRejectDialog documentId={document.id} token={recipient.token} />
          </div>
        </div>

        <div className="relative mt-4 flex w-full flex-col gap-x-6 gap-y-8 sm:mt-8 md:flex-row lg:gap-x-8 lg:gap-y-0">
          <div className="flex-1">
            <Card className="rounded-xl before:rounded-xl" gradient>
              <CardContent className="p-2">
                <PDFViewerLazy
                  key={document.envelopeItems[0].id}
                  envelopeItem={document.envelopeItems[0]}
                  token={recipient.token}
                  version="signed"
                />
              </CardContent>
            </Card>
          </div>

          <div
            key={isExpanded ? 'expanded' : 'collapsed'}
            className="group/document-widget fixed bottom-6 left-0 z-50 h-fit max-h-[calc(100dvh-2rem)] w-full flex-shrink-0 px-4 md:sticky md:bottom-[unset] md:top-4 md:z-auto md:w-[350px] md:px-0"
            data-expanded={isExpanded || undefined}
          >
            <div className="flex w-full flex-col rounded-xl border border-border bg-widget px-4 py-4 md:py-6">
              <div className="flex items-center justify-between gap-x-2">
                <h3 className="text-xl font-semibold text-foreground md:text-2xl">
                  {match(recipient.role)
                    .with(RecipientRole.VIEWER, () => <Trans>View Document</Trans>)
                    .with(RecipientRole.SIGNER, () => <Trans>Sign Document</Trans>)
                    .with(RecipientRole.APPROVER, () => <Trans>Approve Document</Trans>)
                    .with(RecipientRole.ASSISTANT, () => <Trans>Assist Document</Trans>)
                    .otherwise(() => null)}
                </h3>

                {match({ hasPendingFields, isExpanded, role: recipient.role })
                  .with(
                    {
                      hasPendingFields: false,
                      role: P.not(RecipientRole.ASSISTANT),
                      isExpanded: false,
                    },
                    () => (
                      <div className="md:hidden">
                        <DocumentSigningCompleteDialog
                          isSubmitting={isSubmitting}
                          documentTitle={document.title}
                          fields={fields}
                          fieldsValidated={fieldsValidated}
                          disabled={!isRecipientsTurn}
                          onSignatureComplete={async (nextSigner) =>
                            completeDocument({ nextSigner })
                          }
                          recipient={recipient}
                          allowDictateNextSigner={
                            nextRecipient && documentMeta?.allowDictateNextSigner
                          }
                          defaultNextSigner={
                            nextRecipient
                              ? { name: nextRecipient.name, email: nextRecipient.email }
                              : undefined
                          }
                        />
                      </div>
                    ),
                  )
                  .with({ isExpanded: true }, () => (
                    <Button
                      variant="outline"
                      className="h-8 w-8 bg-background p-0 md:hidden dark:bg-foreground"
                      onClick={() => setIsExpanded(false)}
                    >
                      <LucideChevronDown className="h-5 w-5 text-muted-foreground dark:text-background" />
                    </Button>
                  ))
                  .otherwise(() => (
                    <Button
                      variant="outline"
                      className="h-8 w-8 bg-background p-0 md:hidden dark:bg-foreground"
                      onClick={() => setIsExpanded(true)}
                    >
                      <LucideChevronUp className="h-5 w-5 text-muted-foreground dark:text-background" />
                    </Button>
                  ))}
              </div>

              <div className="hidden group-data-[expanded]/document-widget:block md:block">
                <p className="mt-2 text-sm text-muted-foreground">
                  {match(recipient.role)
                    .with(RecipientRole.VIEWER, () => (
                      <Trans>Please mark as viewed to complete.</Trans>
                    ))
                    .with(RecipientRole.SIGNER, () => (
                      <Trans>Please review the document before signing.</Trans>
                    ))
                    .with(RecipientRole.APPROVER, () => (
                      <Trans>Please review the document before approving.</Trans>
                    ))
                    .with(RecipientRole.ASSISTANT, () => (
                      <Trans>Complete the fields for the following signers.</Trans>
                    ))
                    .otherwise(() => null)}
                </p>

                <hr className="mb-8 mt-4 border-border" />
              </div>

              <div className="-mx-2 hidden px-2 group-data-[expanded]/document-widget:block md:block">
                <DocumentSigningForm
                  document={document}
                  recipient={recipient}
                  fields={fields}
                  isRecipientsTurn={isRecipientsTurn}
                  allRecipients={allRecipients}
                  setSelectedSignerId={setSelectedSignerId}
                  completeDocument={completeDocument}
                  isSubmitting={isSubmitting}
                  fieldsValidated={fieldsValidated}
                  nextRecipient={nextRecipient}
                />
              </div>
            </div>
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

        <ElementVisible
          target={`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${highestPageNumber}"]`}
        >
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
