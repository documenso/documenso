'use client';

import { useThrottleFn } from '@documenso/lib/client-only/hooks/use-throttle-fn';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { validateFieldsInserted } from '@documenso/lib/utils/fields';
import type { DocumentMeta, Recipient, TemplateMeta } from '@documenso/prisma/client';
import { type DocumentData, type Field } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useEffect, useState } from 'react';

import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { LucideChevronDown, LucideChevronUp } from 'lucide-react';
import { useRequiredSigningContext } from '~/app/(signing)/sign/[token]/provider';
import { Logo } from '~/components/branding/logo';
import { EmbedClientLoading } from '../../client-loading';
import { EmbedDocumentCompleted } from '../../completed';
import { EmbedDocumentFields } from '../../document-fields';
import { ZSignDocumentEmbedDataSchema } from './schema';

export type EmbedSignDocumentClientPageProps = {
  token: string;
  documentId: number;
  documentData: DocumentData;
  recipient: Recipient;
  fields: Field[];
  metadata?: DocumentMeta | TemplateMeta | null;
  isCompleted?: boolean;
};

export const EmbedSignDocumentClientPage = ({
  token,
  documentId,
  documentData,
  recipient,
  fields,
  metadata,
  isCompleted,
}: EmbedSignDocumentClientPageProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { fullName, email, signature, setFullName, setSignature } = useRequiredSigningContext();

  const [hasFinishedInit, setHasFinishedInit] = useState(false);
  const [hasDocumentLoaded, setHasDocumentLoaded] = useState(false);
  const [hasCompletedDocument, setHasCompletedDocument] = useState(isCompleted);

  const [isExpanded, setIsExpanded] = useState(false);

  const [isNameLocked, setIsNameLocked] = useState(false);

  const [showPendingFieldTooltip, setShowPendingFieldTooltip] = useState(false);

  const [throttledOnCompleteClick, isThrottled] = useThrottleFn(() => void onCompleteClick(), 500);

  const [pendingFields, _completedFields] = [
    fields.filter((field) => !field.inserted),
    fields.filter((field) => field.inserted),
  ];

  const { mutateAsync: completeDocumentWithToken, isLoading: isSubmitting } =
    trpc.recipient.completeDocumentWithToken.useMutation();

  const onNextFieldClick = () => {
    validateFieldsInserted(fields);

    setShowPendingFieldTooltip(true);
    setIsExpanded(false);
  };

  const onCompleteClick = async () => {
    try {
      const valid = validateFieldsInserted(fields);

      if (!valid) {
        setShowPendingFieldTooltip(true);
        return;
      }

      await completeDocumentWithToken({
        documentId,
        token,
      });

      if (window.parent) {
        window.parent.postMessage(
          {
            action: 'document-completed',
            data: {
              token,
              documentId,
              recipientId: recipient.id,
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
            data: null,
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

  useEffect(() => {
    const hash = window.location.hash.slice(1);

    try {
      const data = ZSignDocumentEmbedDataSchema.parse(JSON.parse(decodeURIComponent(atob(hash))));

      if (!isCompleted && data.name) {
        setFullName(data.name);
      }

      // Since a recipient can be provided a name we can lock it without requiring
      // a to be provided by the parent application, unlike direct templates.
      setIsNameLocked(!!data.lockName);
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
          typedSignature: null,
          signatureImageAsBase64: signature,
        }}
      />
    );
  }

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-screen-lg flex-col items-center justify-center p-6">
      {(!hasFinishedInit || !hasDocumentLoaded) && <EmbedClientLoading />}

      <div className="relative flex flex-col md:flex-row w-full gap-x-6 gap-y-12">
        {/* Viewer */}
        <div className="flex-1">
          <LazyPDFViewer
            documentData={documentData}
            onDocumentLoad={() => setHasDocumentLoaded(true)}
          />
        </div>

        {/* Widget */}
        <div
          className="group/document-widget fixed md:sticky md:top-4 left-0 w-full bottom-8 px-6 md:px-0 z-50 md:z-auto md:w-[350px] flex-shrink-0 h-fit"
          data-expanded={isExpanded || undefined}
        >
          <div className="w-full border-border bg-widget flex  flex-col rounded-xl border px-4 py-4 md:py-6">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between gap-x-2">
                <h3 className="text-foreground text-xl md:text-2xl font-semibold">
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

            <div className="hidden group-data-[expanded]/document-widget:block md:block">
              <p className="text-muted-foreground mt-2 text-sm">
                <Trans>Sign the document to complete the process.</Trans>
              </p>

              <hr className="border-border mb-8 mt-4" />
            </div>

            {/* Form */}
            <div className="-mx-2 px-2 hidden group-data-[expanded]/document-widget:block md:block">
              <div className="flex flex-1 flex-col gap-y-4">
                <div>
                  <Label htmlFor="full-name">
                    <Trans>Full Name</Trans>
                  </Label>

                  <Input
                    type="text"
                    id="full-name"
                    className="bg-background mt-2"
                    disabled={isNameLocked}
                    value={fullName}
                    onChange={(e) => !isNameLocked && setFullName(e.target.value.trim())}
                  />
                </div>

                <div>
                  <Label htmlFor="email">
                    <Trans>Email</Trans>
                  </Label>

                  <Input
                    type="email"
                    id="email"
                    className="bg-background mt-2"
                    value={email}
                    disabled
                  />
                </div>

                <div>
                  <Label htmlFor="Signature">
                    <Trans>Signature</Trans>
                  </Label>

                  <Card className="mt-2" gradient degrees={-120}>
                    <CardContent className="p-0">
                      <SignaturePad
                        key={signature}
                        className="h-44 w-full"
                        disabled={isThrottled || isSubmitting}
                        defaultValue={signature ?? undefined}
                        onChange={(value) => {
                          setSignature(value);
                        }}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            <div className="flex-1 hidden group-data-[expanded]/document-widget:block md:block" />

            <div className="w-full grid-cols-2 items-center mt-4 hidden group-data-[expanded]/document-widget:grid md:grid">
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

        <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
          {showPendingFieldTooltip && pendingFields.length > 0 && (
            <FieldToolTip key={pendingFields[0].id} field={pendingFields[0]} color="warning">
              <Trans>Click to insert field</Trans>
            </FieldToolTip>
          )}
        </ElementVisible>

        {/* Fields */}
        <EmbedDocumentFields recipient={recipient} fields={fields} metadata={metadata} />
      </div>

      <div className="bg-primary text-primary-foreground fixed bottom-0 left-0 z-40 rounded-tr px-2 py-1 text-xs font-medium opacity-60 hover:opacity-100">
        <span>Powered by</span>
        <Logo className="ml-2 inline-block h-[14px]" />
      </div>
    </div>
  );
};
