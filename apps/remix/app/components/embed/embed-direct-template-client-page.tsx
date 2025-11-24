import { useEffect, useLayoutEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { DocumentMeta, EnvelopeItem, Recipient, Signature } from '@prisma/client';
import { type Field, FieldType } from '@prisma/client';
import { LucideChevronDown, LucideChevronUp } from 'lucide-react';
import { DateTime } from 'luxon';
import { useSearchParams } from 'react-router';

import { useThrottleFn } from '@documenso/lib/client-only/hooks/use-throttle-fn';
import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import {
  isFieldUnsignedAndRequired,
  isRequiredField,
} from '@documenso/lib/utils/advanced-fields-helpers';
import { validateFieldsInserted } from '@documenso/lib/utils/fields';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { Button } from '@documenso/ui/primitives/button';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { PDFViewerLazy } from '@documenso/ui/primitives/pdf-viewer/lazy';
import { SignaturePadDialog } from '@documenso/ui/primitives/signature-pad/signature-pad-dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { BrandingLogo } from '~/components/general/branding-logo';
import { ZDirectTemplateEmbedDataSchema } from '~/types/embed-direct-template-schema';
import { injectCss } from '~/utils/css-vars';

import type { DirectTemplateLocalField } from '../general/direct-template/direct-template-signing-form';
import { DocumentSigningAttachmentsPopover } from '../general/document-signing/document-signing-attachments-popover';
import { useRequiredDocumentSigningContext } from '../general/document-signing/document-signing-provider';
import { EmbedClientLoading } from './embed-client-loading';
import { EmbedDocumentCompleted } from './embed-document-completed';
import { EmbedDocumentFields } from './embed-document-fields';

export type EmbedDirectTemplateClientPageProps = {
  token: string;
  envelopeId: string;
  updatedAt: Date;
  envelopeItems: Pick<EnvelopeItem, 'id' | 'envelopeId'>[];
  recipient: Recipient;
  fields: Field[];
  metadata?: DocumentMeta | null;
  hidePoweredBy?: boolean;
  allowWhiteLabelling?: boolean;
};

export const EmbedDirectTemplateClientPage = ({
  token,
  envelopeId,
  updatedAt,
  envelopeItems,
  recipient,
  fields,
  metadata,
  hidePoweredBy = false,
  allowWhiteLabelling = false,
}: EmbedDirectTemplateClientPageProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [searchParams] = useSearchParams();

  const { fullName, email, signature, setFullName, setEmail, setSignature } =
    useRequiredDocumentSigningContext();

  const [hasFinishedInit, setHasFinishedInit] = useState(false);
  const [hasDocumentLoaded, setHasDocumentLoaded] = useState(false);
  const [hasCompletedDocument, setHasCompletedDocument] = useState(false);

  const [isExpanded, setIsExpanded] = useState(false);

  const [isEmailLocked, setIsEmailLocked] = useState(false);
  const [isNameLocked, setIsNameLocked] = useState(false);

  const [showPendingFieldTooltip, setShowPendingFieldTooltip] = useState(false);

  const [throttledOnCompleteClick, isThrottled] = useThrottleFn(() => void onCompleteClick(), 500);

  const [localFields, setLocalFields] = useState<DirectTemplateLocalField[]>(() => fields);

  const [pendingFields, _completedFields] = [
    localFields.filter((field) => isFieldUnsignedAndRequired(field)),
    localFields.filter((field) => field.inserted),
  ];

  const highestPendingPageNumber = Math.max(...pendingFields.map((field) => field.page));

  const hasSignatureField = localFields.some((field) => field.type === FieldType.SIGNATURE);

  const signatureValid = !hasSignatureField || (signature && signature.trim() !== '');

  const { mutateAsync: createDocumentFromDirectTemplate, isPending: isSubmitting } =
    trpc.template.createDocumentFromDirectTemplate.useMutation();

  const onSignField = (payload: TSignFieldWithTokenMutationSchema) => {
    setLocalFields((fields) =>
      fields.map((field) => {
        if (field.id !== payload.fieldId) {
          return field;
        }

        const newField: DirectTemplateLocalField = structuredClone({
          ...field,
          customText: payload.value ?? '',
          inserted: true,
          signedValue: payload,
        });

        if (field.type === FieldType.SIGNATURE) {
          newField.signature = {
            id: 1,
            created: new Date(),
            recipientId: 1,
            fieldId: 1,
            signatureImageAsBase64:
              payload.value && payload.value.startsWith('data:') ? payload.value : null,
            typedSignature:
              payload.value && !payload.value.startsWith('data:') ? payload.value : null,
          } satisfies Signature;
        }

        if (field.type === FieldType.DATE) {
          newField.customText = DateTime.now()
            .setZone(metadata?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE)
            .toFormat(metadata?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT);
        }

        return newField;
      }),
    );

    if (window.parent) {
      window.parent.postMessage(
        {
          action: 'field-signed',
          data: null,
        },
        '*',
      );
    }

    setShowPendingFieldTooltip(false);
  };

  const onUnsignField = (payload: TRemovedSignedFieldWithTokenMutationSchema) => {
    setLocalFields((fields) =>
      fields.map((field) => {
        if (field.id !== payload.fieldId) {
          return field;
        }

        return structuredClone({
          ...field,
          customText: '',
          inserted: false,
          signedValue: undefined,
          signature: undefined,
        });
      }),
    );

    if (window.parent) {
      window.parent.postMessage(
        {
          action: 'field-unsigned',
          data: null,
        },
        '*',
      );
    }

    setShowPendingFieldTooltip(false);
  };

  const onNextFieldClick = () => {
    validateFieldsInserted(pendingFields);

    setShowPendingFieldTooltip(true);
    setIsExpanded(false);
  };

  const onCompleteClick = async () => {
    try {
      const valid = validateFieldsInserted(pendingFields);

      if (!valid) {
        setShowPendingFieldTooltip(true);
        return;
      }

      let directTemplateExternalId = searchParams?.get('externalId') || undefined;

      if (directTemplateExternalId) {
        directTemplateExternalId = decodeURIComponent(directTemplateExternalId);
      }

      const {
        documentId,
        token: documentToken,
        recipientId,
      } = await createDocumentFromDirectTemplate({
        directTemplateToken: token,
        directTemplateExternalId,
        directRecipientName: fullName,
        directRecipientEmail: email,
        templateUpdatedAt: updatedAt,
        signedFieldValues: localFields
          .filter((field) => {
            return field.signedValue && (isRequiredField(field) || field.inserted);
          })
          .map((field) => field.signedValue!),
      });

      if (window.parent) {
        window.parent.postMessage(
          {
            action: 'document-completed',
            data: {
              token: documentToken,
              documentId,
              recipientId,
            },
          },
          '*',
        );
      }

      setHasCompletedDocument(true);
    } catch (err) {
      if (window.parent) {
        window.parent.postMessage(
          {
            action: 'document-error',
            data: String(err),
          },
          '*',
        );
      }

      toast({
        title: _(msg`Something went wrong`),
        description: _(
          msg`We were unable to submit this document at this time. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  useLayoutEffect(() => {
    const hash = window.location.hash.slice(1);

    try {
      const data = ZDirectTemplateEmbedDataSchema.parse(JSON.parse(decodeURIComponent(atob(hash))));

      if (data.email) {
        setEmail(data.email);
        setIsEmailLocked(!!data.lockEmail);
      }

      if (data.name) {
        setFullName(data.name);
        setIsNameLocked(!!data.lockName);
      }

      if (data.darkModeDisabled) {
        document.documentElement.classList.add('dark-mode-disabled');
      }

      if (allowWhiteLabelling) {
        injectCss({
          css: data.css,
          cssVars: data.cssVars,
        });
      }
    } catch (err) {
      console.error(err);
    }

    setHasFinishedInit(true);

    // !: While the two setters are stable we still want to ensure we're avoiding
    // !: re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasFinishedInit && hasDocumentLoaded && window.parent) {
      window.parent.postMessage(
        {
          action: 'document-ready',
          data: null,
        },
        '*',
      );
    }
  }, [hasFinishedInit, hasDocumentLoaded]);

  if (hasCompletedDocument) {
    return (
      <EmbedDocumentCompleted
        name={fullName}
        signature={{
          id: 1,
          fieldId: 1,
          recipientId: 1,
          created: new Date(),
          signatureImageAsBase64: signature?.startsWith('data:') ? signature : null,
          typedSignature: signature?.startsWith('data:') ? null : signature,
        }}
      />
    );
  }

  return (
    <div className="embed--Root relative mx-auto flex min-h-[100dvh] max-w-screen-lg flex-col items-center justify-center p-6">
      {(!hasFinishedInit || !hasDocumentLoaded) && <EmbedClientLoading />}

      <div className="embed--Actions mb-4 flex w-full flex-row-reverse items-baseline justify-between">
        <DocumentSigningAttachmentsPopover envelopeId={envelopeId} token={recipient.token} />
      </div>

      <div className="relative flex w-full flex-col gap-x-6 gap-y-12 md:flex-row">
        {/* Viewer */}
        <div className="flex-1">
          <PDFViewerLazy
            envelopeItem={envelopeItems[0]}
            token={recipient.token}
            version="signed"
            onDocumentLoad={() => setHasDocumentLoaded(true)}
          />
        </div>

        {/* Widget */}
        <div
          key={isExpanded ? 'expanded' : 'collapsed'}
          className="group/document-widget fixed bottom-8 left-0 z-50 h-fit max-h-[calc(100dvh-2rem)] w-full flex-shrink-0 px-6 md:sticky md:bottom-[unset] md:top-4 md:z-auto md:w-[350px] md:px-0"
          data-expanded={isExpanded || undefined}
        >
          <div className="flex h-fit w-full flex-col rounded-xl border border-border bg-widget px-4 py-4 md:min-h-[min(calc(100dvh-2rem),48rem)] md:py-6">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between gap-x-2">
                <h3 className="text-xl font-semibold text-foreground md:text-2xl">
                  <Trans>Sign document</Trans>
                </h3>

                {isExpanded ? (
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0 md:hidden"
                    onClick={() => setIsExpanded(false)}
                  >
                    <LucideChevronDown className="h-5 w-5 text-muted-foreground" />
                  </Button>
                ) : pendingFields.length > 0 ? (
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0 md:hidden"
                    onClick={() => setIsExpanded(true)}
                  >
                    <LucideChevronUp className="h-5 w-5 text-muted-foreground" />
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    className="md:hidden"
                    disabled={isThrottled || (hasSignatureField && !signatureValid)}
                    loading={isSubmitting}
                    onClick={() => throttledOnCompleteClick()}
                  >
                    <Trans>Complete</Trans>
                  </Button>
                )}
              </div>
            </div>

            <div className="hidden group-data-[expanded]/document-widget:block md:block">
              <p className="mt-2 text-sm text-muted-foreground">
                <Trans>Sign the document to complete the process.</Trans>
              </p>

              <hr className="mb-8 mt-4 border-border" />
            </div>

            {/* Form */}
            <div className="-mx-2 hidden px-2 group-data-[expanded]/document-widget:block md:block">
              <div className="flex flex-1 flex-col gap-y-4">
                <div>
                  <Label htmlFor="full-name">
                    <Trans>Full Name</Trans>
                  </Label>

                  <Input
                    type="text"
                    id="full-name"
                    className="mt-2 bg-background"
                    disabled={isNameLocked}
                    value={fullName}
                    onChange={(e) => !isNameLocked && setFullName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="email">
                    <Trans>Email</Trans>
                  </Label>

                  <Input
                    type="email"
                    id="email"
                    className="mt-2 bg-background"
                    disabled={isEmailLocked}
                    value={email}
                    onChange={(e) => !isEmailLocked && setEmail(e.target.value.trim())}
                  />
                </div>

                {hasSignatureField && (
                  <div>
                    <Label htmlFor="Signature">
                      <Trans>Signature</Trans>
                    </Label>

                    <SignaturePadDialog
                      className="mt-2"
                      disabled={isThrottled || isSubmitting}
                      disableAnimation
                      value={signature ?? ''}
                      onChange={(v) => setSignature(v ?? '')}
                      typedSignatureEnabled={metadata?.typedSignatureEnabled}
                      uploadSignatureEnabled={metadata?.uploadSignatureEnabled}
                      drawSignatureEnabled={metadata?.drawSignatureEnabled}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="hidden flex-1 group-data-[expanded]/document-widget:block md:block" />

            <div className="mt-4 hidden w-full grid-cols-2 items-center group-data-[expanded]/document-widget:grid md:grid">
              {pendingFields.length > 0 ? (
                <Button className="col-start-2" onClick={() => onNextFieldClick()}>
                  <Trans>Next</Trans>
                </Button>
              ) : (
                <Button
                  className="col-start-2"
                  disabled={isThrottled}
                  loading={isSubmitting}
                  onClick={() => throttledOnCompleteClick()}
                >
                  <Trans>Complete</Trans>
                </Button>
              )}
            </div>
          </div>
        </div>

        <ElementVisible
          target={`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${highestPendingPageNumber}"]`}
        >
          {showPendingFieldTooltip && pendingFields.length > 0 && (
            <FieldToolTip key={pendingFields[0].id} field={pendingFields[0]} color="warning">
              <Trans>Click to insert field</Trans>
            </FieldToolTip>
          )}
        </ElementVisible>

        {/* Fields */}
        <EmbedDocumentFields
          fields={localFields}
          metadata={metadata}
          onSignField={onSignField}
          onUnsignField={onUnsignField}
        />
      </div>

      {!hidePoweredBy && (
        <div className="fixed bottom-0 left-0 z-40 rounded-tr bg-primary px-2 py-1 text-xs font-medium text-primary-foreground opacity-60 hover:opacity-100">
          <span>Powered by</span>
          <BrandingLogo className="ml-2 inline-block h-[14px]" />
        </div>
      )}
    </div>
  );
};
