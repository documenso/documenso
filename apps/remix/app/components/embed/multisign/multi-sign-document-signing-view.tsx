import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus, FieldType, SigningStatus } from '@prisma/client';
import { Loader, LucideChevronDown, LucideChevronUp, X } from 'lucide-react';
import { P, match } from 'ts-pattern';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { DocumentReadOnlyFields } from '@documenso/ui/components/document/document-read-only-fields';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { PDFViewerLazy } from '@documenso/ui/primitives/pdf-viewer/lazy';
import { SignaturePadDialog } from '@documenso/ui/primitives/signature-pad/signature-pad-dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentSigningContext } from '../../general/document-signing/document-signing-provider';
import { DocumentSigningRejectDialog } from '../../general/document-signing/document-signing-reject-dialog';
import { EmbedDocumentFields } from '../embed-document-fields';

interface MultiSignDocumentSigningViewProps {
  token: string;
  recipientId: number;
  onBack: () => void;
  onDocumentCompleted?: (data: { token: string; documentId: number; recipientId: number }) => void;
  onDocumentRejected?: (data: {
    token: string;
    documentId: number;
    recipientId: number;
    reason: string;
  }) => void;
  onDocumentError?: () => void;
  onDocumentReady?: () => void;
  isNameLocked?: boolean;
  allowDocumentRejection?: boolean;
}

export const MultiSignDocumentSigningView = ({
  token,
  recipientId,
  onBack,
  onDocumentCompleted,
  onDocumentRejected,
  onDocumentError,
  onDocumentReady,
  isNameLocked = false,
  allowDocumentRejection = false,
}: MultiSignDocumentSigningViewProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { fullName, email, signature, setFullName, setSignature } =
    useRequiredDocumentSigningContext();

  const [hasDocumentLoaded, setHasDocumentLoaded] = useState(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPendingFieldTooltip, setShowPendingFieldTooltip] = useState(false);

  const { data: document, isLoading } = trpc.embeddingPresign.getMultiSignDocument.useQuery(
    { token },
    {
      staleTime: 0,
    },
  );

  const { mutateAsync: signFieldWithToken } = trpc.field.signFieldWithToken.useMutation();
  const { mutateAsync: removeSignedFieldWithToken } =
    trpc.field.removeSignedFieldWithToken.useMutation();

  const { mutateAsync: completeDocumentWithToken } =
    trpc.recipient.completeDocumentWithToken.useMutation();

  const hasSignatureField = document?.fields.some((field) => field.type === FieldType.SIGNATURE);

  const [pendingFields, completedFields] = [
    document?.fields.filter((field) => field.recipient.signingStatus !== SigningStatus.SIGNED) ??
      [],
    document?.fields.filter((field) => field.recipient.signingStatus === SigningStatus.SIGNED) ??
      [],
  ];

  const highestPendingPageNumber = Math.max(...pendingFields.map((field) => field.page));

  const uninsertedFields = document?.fields.filter((field) => !field.inserted) ?? [];

  const onSignField = async (payload: TSignFieldWithTokenMutationSchema) => {
    try {
      await signFieldWithToken(payload);
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while signing the document.`),
        variant: 'destructive',
      });
    }
  };

  const onUnsignField = async (payload: TRemovedSignedFieldWithTokenMutationSchema) => {
    try {
      await removeSignedFieldWithToken(payload);
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);
    }
  };

  const onDocumentComplete = async () => {
    try {
      setIsSubmitting(true);

      await completeDocumentWithToken({
        documentId: document!.id,
        token,
      });

      onBack();

      onDocumentCompleted?.({
        token,
        documentId: document!.id,
        recipientId,
      });
    } catch (err) {
      onDocumentError?.();

      toast({
        title: _(msg`Error`),
        description: _(msg`Failed to complete the document. Please try again.`),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onNextFieldClick = () => {
    setShowPendingFieldTooltip(true);

    setIsExpanded(false);
  };

  const onRejected = (reason: string) => {
    if (onDocumentRejected && document) {
      onDocumentRejected({
        token,
        documentId: document.id,
        recipientId,
        reason,
      });
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <div id="document-field-portal-root" className="relative h-full w-full overflow-y-auto p-8">
        {match({ isLoading, document })
          .with({ isLoading: true }, () => (
            <div className="flex min-h-[400px] w-full items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Loader className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  <Trans>Loading document...</Trans>
                </p>
              </div>
            </div>
          ))
          .with({ isLoading: false, document: undefined }, () => (
            <div className="flex min-h-[400px] w-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                <Trans>Failed to load document</Trans>
              </p>
            </div>
          ))
          .with({ document: P.nonNullable }, ({ document }) => (
            <>
              <div className="mx-auto flex w-full max-w-screen-xl items-baseline justify-between">
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl font-semibold">{document.title}</h1>
                </div>

                <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {allowDocumentRejection && (
                <div className="embed--Actions mb-4 mt-8 flex w-full flex-row-reverse items-baseline justify-between">
                  <DocumentSigningRejectDialog
                    documentId={document.id}
                    token={token}
                    onRejected={onRejected}
                  />
                </div>
              )}

              <div className="embed--DocumentContainer relative mx-auto mt-8 flex w-full max-w-screen-xl flex-col gap-x-6 gap-y-12 md:flex-row">
                <div
                  className={cn('embed--DocumentViewer flex-1', {
                    'md:mx-auto md:max-w-2xl': document.status === DocumentStatus.COMPLETED,
                  })}
                >
                  <PDFViewerLazy
                    envelopeItem={document.envelopeItems[0]}
                    token={token}
                    version="signed"
                    onDocumentLoad={() => {
                      setHasDocumentLoaded(true);
                      onDocumentReady?.();
                    }}
                  />
                </div>

                {/* Widget */}
                {document.status !== DocumentStatus.COMPLETED && (
                  <div
                    key={isExpanded ? 'expanded' : 'collapsed'}
                    className="embed--DocumentWidgetContainer group/document-widget fixed bottom-8 left-0 z-50 h-fit max-h-[calc(100dvh-2rem)] w-full flex-shrink-0 px-6 md:sticky md:bottom-[unset] md:top-0 md:z-auto md:w-[350px] md:px-0"
                    data-expanded={isExpanded || undefined}
                  >
                    <div className="embed--DocumentWidget flex w-full flex-col rounded-xl border border-border bg-widget px-4 py-4 md:py-6">
                      {/* Header */}
                      <div className="embed--DocumentWidgetHeader">
                        <div className="flex items-center justify-between gap-x-2">
                          <h3 className="text-xl font-semibold text-foreground md:text-2xl">
                            <Trans>Sign document</Trans>
                          </h3>

                          <Button variant="outline" className="h-8 w-8 p-0 md:hidden">
                            {isExpanded ? (
                              <LucideChevronDown
                                className="h-5 w-5 text-muted-foreground"
                                onClick={() => setIsExpanded(false)}
                              />
                            ) : (
                              <LucideChevronUp
                                className="h-5 w-5 text-muted-foreground"
                                onClick={() => setIsExpanded(true)}
                              />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="embed--DocumentWidgetContent hidden group-data-[expanded]/document-widget:block md:block">
                        <p className="mt-2 text-sm text-muted-foreground">
                          <Trans>Sign the document to complete the process.</Trans>
                        </p>

                        <hr className="mb-8 mt-4 border-border" />
                      </div>

                      {/* Form */}
                      <div className="embed--DocumentWidgetForm -mx-2 hidden px-2 group-data-[expanded]/document-widget:block md:block">
                        <div className="flex flex-1 flex-col gap-y-4">
                          {
                            <>
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
                                  value={email}
                                  disabled
                                />
                              </div>

                              {hasSignatureField && (
                                <div>
                                  <Label htmlFor="Signature">
                                    <Trans>Signature</Trans>
                                  </Label>

                                  <SignaturePadDialog
                                    className="mt-2"
                                    disabled={isSubmitting}
                                    disableAnimation
                                    value={signature ?? ''}
                                    onChange={(v) => setSignature(v ?? '')}
                                    typedSignatureEnabled={
                                      document.documentMeta?.typedSignatureEnabled
                                    }
                                    uploadSignatureEnabled={
                                      document.documentMeta?.uploadSignatureEnabled
                                    }
                                    drawSignatureEnabled={
                                      document.documentMeta?.drawSignatureEnabled
                                    }
                                  />
                                </div>
                              )}
                            </>
                          }
                        </div>
                      </div>

                      <div className="hidden flex-1 group-data-[expanded]/document-widget:block md:block" />

                      <div className="embed--DocumentWidgetFooter mt-4 hidden w-full grid-cols-2 items-center group-data-[expanded]/document-widget:grid md:grid">
                        {uninsertedFields.length > 0 ? (
                          <Button className="col-start-2" onClick={onNextFieldClick}>
                            <Trans>Next</Trans>
                          </Button>
                        ) : (
                          <Button
                            className="col-span-2"
                            loading={isSubmitting}
                            onClick={onDocumentComplete}
                          >
                            <Trans>Complete</Trans>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {hasDocumentLoaded && (
                <ElementVisible
                  target={`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${highestPendingPageNumber}"]`}
                >
                  {showPendingFieldTooltip && pendingFields.length > 0 && (
                    <FieldToolTip
                      key={pendingFields[0].id}
                      field={pendingFields[0]}
                      color="warning"
                    >
                      <Trans>Click to insert field</Trans>
                    </FieldToolTip>
                  )}
                </ElementVisible>
              )}

              {/* Fields */}
              {hasDocumentLoaded && (
                <EmbedDocumentFields
                  fields={pendingFields}
                  metadata={document.documentMeta}
                  onSignField={onSignField}
                  onUnsignField={onUnsignField}
                />
              )}

              {/* Completed fields */}
              {document.status !== DocumentStatus.COMPLETED && (
                <DocumentReadOnlyFields
                  documentMeta={document.documentMeta ?? undefined}
                  fields={completedFields}
                />
              )}
            </>
          ))
          .otherwise(() => null)}
      </div>
    </div>
  );
};
