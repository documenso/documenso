import { lazy, useMemo } from 'react';

import { Plural, Trans } from '@lingui/react/macro';
import { EnvelopeType, RecipientRole } from '@prisma/client';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, BanIcon, DownloadCloudIcon, PaperclipIcon } from 'lucide-react';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import PDFViewerKonvaLazy from '@documenso/ui/components/pdf-viewer/pdf-viewer-konva-lazy';
import { Button } from '@documenso/ui/primitives/button';
import { Separator } from '@documenso/ui/primitives/separator';

import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';
import { SignFieldCheckboxDialog } from '~/components/dialogs/sign-field-checkbox-dialog';
import { SignFieldDropdownDialog } from '~/components/dialogs/sign-field-dropdown-dialog';
import { SignFieldEmailDialog } from '~/components/dialogs/sign-field-email-dialog';
import { SignFieldInitialsDialog } from '~/components/dialogs/sign-field-initials-dialog';
import { SignFieldNameDialog } from '~/components/dialogs/sign-field-name-dialog';
import { SignFieldNumberDialog } from '~/components/dialogs/sign-field-number-dialog';
import { SignFieldSignatureDialog } from '~/components/dialogs/sign-field-signature-dialog';
import { SignFieldTextDialog } from '~/components/dialogs/sign-field-text-dialog';
import { useEmbedSigningContext } from '~/components/embed/embed-signing-context';

import { BrandingLogo } from '../branding-logo';
import { DocumentSigningAttachmentsPopover } from '../document-signing/document-signing-attachments-popover';
import { EnvelopeItemSelector } from '../envelope-editor/envelope-file-selector';
import EnvelopeSignerForm from '../envelope-signing/envelope-signer-form';
import { EnvelopeSignerHeader } from '../envelope-signing/envelope-signer-header';
import { DocumentSigningMobileWidget } from './document-signing-mobile-widget';
import { DocumentSigningRejectDialog } from './document-signing-reject-dialog';
import { useRequiredEnvelopeSigningContext } from './envelope-signing-provider';

const EnvelopeSignerPageRenderer = lazy(
  async () => import('~/components/general/envelope-signing/envelope-signer-page-renderer'),
);

export const DocumentSigningPageViewV2 = () => {
  const { envelopeItems, currentEnvelopeItem, setCurrentEnvelopeItem } = useCurrentEnvelopeRender();

  const {
    isDirectTemplate,
    envelope,
    recipient,
    recipientFields,
    recipientFieldsRemaining,
    requiredRecipientFields,
    selectedAssistantRecipientFields,
  } = useRequiredEnvelopeSigningContext();

  const {
    isEmbed = false,
    allowDocumentRejection = true,
    hidePoweredBy = true,
    onDocumentRejected,
  } = useEmbedSigningContext() || {};

  /**
   * The total remaining fields remaining for the current recipient or selected assistant recipient.
   *
   * Includes both optional and required fields.
   */
  const remainingFields = useMemo(() => {
    if (recipient.role === RecipientRole.ASSISTANT) {
      return selectedAssistantRecipientFields.filter((field) => !field.inserted);
    }

    return recipientFields.filter((field) => !field.inserted);
  }, [recipientFieldsRemaining, selectedAssistantRecipientFields, currentEnvelopeItem]);

  return (
    <div className="min-h-screen w-screen bg-gray-50 dark:bg-background">
      <SignFieldEmailDialog.Root />
      <SignFieldTextDialog.Root />
      <SignFieldNumberDialog.Root />
      <SignFieldNameDialog.Root />
      <SignFieldInitialsDialog.Root />
      <SignFieldDropdownDialog.Root />
      <SignFieldSignatureDialog.Root />
      <SignFieldCheckboxDialog.Root />

      <EnvelopeSignerHeader />

      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-4rem)] w-screen">
        {/* Left Section - Step Navigation */}
        <div className="embed--DocumentWidgetContainer hidden w-80 flex-shrink-0 flex-col overflow-y-auto border-r border-border bg-background py-4 lg:flex">
          <div className="px-4">
            <h3 className="flex items-end justify-between text-sm font-semibold text-foreground">
              {match(recipient.role)
                .with(RecipientRole.VIEWER, () => <Trans>View Document</Trans>)
                .with(RecipientRole.SIGNER, () => <Trans>Sign Document</Trans>)
                .with(RecipientRole.APPROVER, () => <Trans>Approve Document</Trans>)
                .with(RecipientRole.ASSISTANT, () => <Trans>Assist Document</Trans>)
                .otherwise(() => null)}

              <span className="ml-2 rounded border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                <Plural
                  value={recipientFieldsRemaining.length}
                  one="1 Field Remaining"
                  other="# Fields Remaining"
                />
              </span>
            </h3>

            <div className="relative my-4 h-[4px] rounded-md bg-muted">
              <motion.div
                layout="size"
                layoutId="document-flow-container-step"
                className="absolute inset-y-0 left-0 bg-documenso"
                style={{
                  width: `${100 - (100 / requiredRecipientFields.length) * (recipientFieldsRemaining.length ?? 0)}%`,
                }}
              />
            </div>

            <div className="embed--DocumentWidgetContent mt-6 space-y-3">
              <EnvelopeSignerForm />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Quick Actions. */}
          {!isDirectTemplate && (
            <div className="embed--Actions space-y-3 px-4">
              <h4 className="text-sm font-semibold text-foreground">
                <Trans>Actions</Trans>
              </h4>

              <DocumentSigningAttachmentsPopover
                envelopeId={envelope.id}
                token={recipient.token}
                trigger={
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    <PaperclipIcon className="mr-2 h-4 w-4" />
                    <Trans>Attachments</Trans>
                  </Button>
                }
              />

              <EnvelopeDownloadDialog
                envelopeId={envelope.id}
                envelopeStatus={envelope.status}
                envelopeItems={envelope.envelopeItems}
                token={recipient.token}
                trigger={
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    <DownloadCloudIcon className="mr-2 h-4 w-4" />
                    <Trans>Download PDF</Trans>
                  </Button>
                }
              />

              {envelope.type === EnvelopeType.DOCUMENT && allowDocumentRejection && (
                <DocumentSigningRejectDialog
                  documentId={mapSecondaryIdToDocumentId(envelope.secondaryId)}
                  token={recipient.token}
                  onRejected={
                    onDocumentRejected &&
                    ((reason) =>
                      onDocumentRejected({
                        token: recipient.token,
                        documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
                        envelopeId: envelope.id,
                        recipientId: recipient.id,
                        reason,
                      }))
                  }
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start hover:text-destructive"
                    >
                      <BanIcon className="mr-2 h-4 w-4" />
                      <Trans>Reject Document</Trans>
                    </Button>
                  }
                />
              )}
            </div>
          )}

          <div className="embed--DocumentWidgetFooter mt-auto">
            {/* Footer of left sidebar. */}
            {!isEmbed && (
              <div className="px-4">
                <Button asChild variant="ghost" className="w-full justify-start">
                  <Link to="/">
                    <ArrowLeftIcon className="mr-2 h-4 w-4" />
                    <Trans>Return</Trans>
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="embed--DocumentContainer flex-1 overflow-y-auto">
          <div className="flex flex-col">
            {/* Horizontal envelope item selector */}
            {envelopeItems.length > 1 && (
              <div className="flex h-fit space-x-2 overflow-x-auto p-2 pt-4 sm:p-4">
                {envelopeItems.map((doc, i) => (
                  <EnvelopeItemSelector
                    key={doc.id}
                    number={i + 1}
                    primaryText={doc.title}
                    secondaryText={
                      <Plural
                        one="1 Field"
                        other="# Fields"
                        value={
                          remainingFields.filter((field) => field.envelopeItemId === doc.id).length
                        }
                      />
                    }
                    isSelected={currentEnvelopeItem?.id === doc.id}
                    buttonProps={{ onClick: () => setCurrentEnvelopeItem(doc.id) }}
                  />
                ))}
              </div>
            )}

            {/* Document View */}
            <div className="embed--DocumentViewer flex flex-col items-center justify-center p-2 sm:mt-4 sm:p-4">
              {currentEnvelopeItem ? (
                <PDFViewerKonvaLazy
                  renderer="signing"
                  key={currentEnvelopeItem.id}
                  customPageRenderer={EnvelopeSignerPageRenderer}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-32">
                  <p className="text-sm text-foreground">
                    <Trans>No documents found</Trans>
                  </p>
                </div>
              )}

              {/* Mobile widget - Additional padding to allow users to scroll */}
              <div className="block pb-28 lg:hidden">
                <DocumentSigningMobileWidget />
              </div>

              {!hidePoweredBy && (
                <a
                  href="https://documenso.com"
                  target="_blank"
                  className="fixed bottom-0 right-0 z-40 hidden cursor-pointer rounded-tl bg-primary px-2 py-1 text-xs font-medium text-primary-foreground opacity-60 hover:opacity-100 lg:block"
                >
                  <span>Powered by</span>
                  <BrandingLogo className="ml-2 inline-block h-[14px]" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
