import { lazy } from 'react';

import { Plural, Trans } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, BanIcon, DownloadCloudIcon } from 'lucide-react';
import { Link } from 'react-router';

import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import PDFViewerKonvaLazy from '@documenso/ui/components/pdf-viewer/pdf-viewer-konva-lazy';
import { Button } from '@documenso/ui/primitives/button';
import { Separator } from '@documenso/ui/primitives/separator';

import { SignFieldDropdownDialog } from '~/components/dialogs/sign-field-dropdown-dialog';
import { SignFieldEmailDialog } from '~/components/dialogs/sign-field-email-dialog';
import { SignFieldInitialsDialog } from '~/components/dialogs/sign-field-initials-dialog';
import { SignFieldNameDialog } from '~/components/dialogs/sign-field-name-dialog';
import { SignFieldNumberDialog } from '~/components/dialogs/sign-field-number-dialog';
import { SignFieldSignatureDialog } from '~/components/dialogs/sign-field-signature-dialog';
import { SignFieldTextDialog } from '~/components/dialogs/sign-field-text-dialog';

import { EnvelopeItemSelector } from '../envelope-editor/envelope-file-selector';
import EnvelopeSignerForm from '../envelope-signing/envelope-signer-form';
import { EnvelopeSignerHeader } from '../envelope-signing/envelope-signer-header';
import { useRequiredEnvelopeSigningContext } from './envelope-signing-provider';

const EnvelopeSignerPageRenderer = lazy(
  async () => import('../envelope-signing/envelope-signer-page-renderer'),
);

export const DocumentSigningPageViewV2 = () => {
  const { envelopeItems, currentEnvelopeItem, setCurrentEnvelopeItem } = useCurrentEnvelopeRender();

  const { envelope, recipientFields, recipientFieldsRemaining, showPendingFieldTooltip } =
    useRequiredEnvelopeSigningContext();

  return (
    <div className="h-screen w-screen bg-gray-50">
      <SignFieldEmailDialog.Root />
      <SignFieldTextDialog.Root />
      <SignFieldNumberDialog.Root />
      <SignFieldNameDialog.Root />
      <SignFieldInitialsDialog.Root />
      <SignFieldDropdownDialog.Root />
      <SignFieldSignatureDialog.Root />

      <EnvelopeSignerHeader />

      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-73px)] w-screen">
        {/* Left Section - Step Navigation */}
        <div className="hidden w-80 flex-shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white py-4 lg:flex">
          <div className="px-4">
            <h3 className="flex items-end justify-between text-sm font-semibold text-gray-900">
              <Trans>Sign Document</Trans>

              <span className="text-muted-foreground ml-2 rounded border bg-gray-50 px-2 py-0.5 text-xs">
                <Trans>{recipientFieldsRemaining.length} fields remaining</Trans>
              </span>
            </h3>

            <div className="bg-muted relative my-4 h-[4px] rounded-md">
              <motion.div
                layout="size"
                layoutId="document-flow-container-step"
                className="bg-documenso absolute inset-y-0 left-0"
                style={{
                  width: `${(100 / recipientFields.length) * (recipientFieldsRemaining.length ?? 0)}%`,
                }}
              />
            </div>

            <div className="mt-6 space-y-3">
              <EnvelopeSignerForm />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Quick Actions. */}
          <div className="space-y-3 px-4">
            <h4 className="text-sm font-semibold text-gray-900">
              <Trans>Actions</Trans>
            </h4>

            {/* Todo: Allow selecting which document to download and/or the original */}
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <DownloadCloudIcon className="mr-2 h-4 w-4" />
              <Trans>Download Original</Trans>
            </Button>

            {/* Todo: Envelopes */}
            <Button
              variant="ghost"
              size="sm"
              className="hover:text-destructive w-full justify-start"
            >
              <BanIcon className="mr-2 h-4 w-4" />
              <Trans>Reject Document</Trans>
            </Button>
          </div>

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

        {/* Main Content - Changes based on current step */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col">
            {/* Horizontal envelope item selector */}
            <div className="flex h-fit space-x-2 overflow-x-auto p-4">
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
                        recipientFieldsRemaining.filter((field) => field.envelopeItemId === doc.id)
                          .length
                      }
                    />
                  }
                  isSelected={currentEnvelopeItem?.id === doc.id}
                  buttonProps={{ onClick: () => setCurrentEnvelopeItem(doc.id) }}
                />
              ))}
            </div>

            {/* Document View */}
            <div className="mt-4 flex justify-center p-4">
              {currentEnvelopeItem &&
                showPendingFieldTooltip &&
                recipientFieldsRemaining.length > 0 &&
                recipientFieldsRemaining[0]?.envelopeItemId === currentEnvelopeItem?.id && (
                  <FieldToolTip
                    key={recipientFieldsRemaining[0].id}
                    field={recipientFieldsRemaining[0]}
                    color="warning"
                  >
                    <Trans>Click to insert field</Trans>
                  </FieldToolTip>
                )}

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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
