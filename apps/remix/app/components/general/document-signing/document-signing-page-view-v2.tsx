import { lazy, useMemo } from 'react';

import { Plural, Trans } from '@lingui/react/macro';
import { EnvelopeType, RecipientRole } from '@prisma/client';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, BanIcon, DownloadCloudIcon } from 'lucide-react';
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

import { DocumentSigningAttachmentsPopover } from '../document-signing/document-signing-attachments-popover';
import { EnvelopeItemSelector } from '../envelope-editor/envelope-file-selector';
import EnvelopeSignerForm from '../envelope-signing/envelope-signer-form';
import { EnvelopeSignerHeader } from '../envelope-signing/envelope-signer-header';
import { DocumentSigningMobileWidget } from './document-signing-mobile-widget';
import { DocumentSigningRejectDialog } from './document-signing-reject-dialog';
import { useRequiredEnvelopeSigningContext } from './envelope-signing-provider';

const EnvelopeSignerPageRenderer = lazy(
  async () => import('../envelope-signing/envelope-signer-page-renderer'),
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
    <div className="dark:bg-background min-h-screen w-screen bg-gray-50">
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
      <div className="flex h-[calc(100vh-73px)] w-screen">
        {/* Left Section - Step Navigation */}
        <div className="bg-background border-border hidden w-80 flex-shrink-0 flex-col overflow-y-auto border-r py-4 lg:flex">
          <div className="px-4">
            <h3 className="text-foreground flex items-end justify-between text-sm font-semibold">
              {match(recipient.role)
                .with(RecipientRole.VIEWER, () => <Trans>View Document</Trans>)
                .with(RecipientRole.SIGNER, () => <Trans>Sign Document</Trans>)
                .with(RecipientRole.APPROVER, () => <Trans>Approve Document</Trans>)
                .with(RecipientRole.ASSISTANT, () => <Trans>Assist Document</Trans>)
                .otherwise(() => null)}

              <span className="text-muted-foreground bg-muted/50 ml-2 rounded border px-2 py-0.5 text-xs">
                <Plural
                  value={recipientFieldsRemaining.length}
                  one="1 Field Remaining"
                  other="# Fields Remaining"
                />
              </span>
            </h3>

            <div className="bg-muted relative my-4 h-[4px] rounded-md">
              <motion.div
                layout="size"
                layoutId="document-flow-container-step"
                className="bg-documenso absolute inset-y-0 left-0"
                style={{
                  width: `${100 - (100 / requiredRecipientFields.length) * (recipientFieldsRemaining.length ?? 0)}%`,
                }}
              />
            </div>

            <div className="mt-6 space-y-3">
              <EnvelopeSignerForm />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Quick Actions. */}
          {!isDirectTemplate && (
            <div className="space-y-3 px-4">
              <h4 className="text-foreground text-sm font-semibold">
                <Trans>Actions</Trans>
              </h4>

              <div className="w-full">
                <DocumentSigningAttachmentsPopover
                  envelopeId={envelope.id}
                  token={recipient.token}
                />
              </div>

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

              {envelope.type === EnvelopeType.DOCUMENT && (
                <DocumentSigningRejectDialog
                  documentId={mapSecondaryIdToDocumentId(envelope.secondaryId)}
                  token={recipient.token}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:text-destructive w-full justify-start"
                    >
                      <BanIcon className="mr-2 h-4 w-4" />
                      <Trans>Reject Document</Trans>
                    </Button>
                  }
                />
              )}
            </div>
          )}

          {/* Footer of left sidebar. */}
          <div className="mt-auto px-4">
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link to="/">
                <ArrowLeftIcon className="mr-2 h-4 w-4" />
                <Trans>Return</Trans>
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
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
            <div className="flex flex-col items-center justify-center p-2 sm:mt-4 sm:p-4">
              {currentEnvelopeItem ? (
                <PDFViewerKonvaLazy
                  key={currentEnvelopeItem.id}
                  documentDataId={currentEnvelopeItem.documentDataId}
                  customPageRenderer={EnvelopeSignerPageRenderer}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-32">
                  <p className="text-foreground text-sm">
                    <Trans>No documents found</Trans>
                  </p>
                </div>
              )}

              {/* Mobile widget - Additional padding to allow users to scroll */}
              <div className="block pb-16 md:hidden">
                <DocumentSigningMobileWidget />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
