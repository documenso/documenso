import { useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { type DocumentData, DocumentStatus, type EnvelopeItem, EnvelopeType } from '@prisma/client';
import { DownloadIcon } from 'lucide-react';
import { DateTime } from 'luxon';

import {
  EnvelopeRenderProvider,
  useCurrentEnvelopeRender,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
import { PDF_VIEWER_ERROR_MESSAGES } from '@documenso/lib/constants/pdf-viewer-i18n';
import { getDocumentDataUrlForPdfViewer } from '@documenso/lib/utils/envelope-download';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';
import { EnvelopePdfViewer } from '~/components/general/pdf-viewer/envelope-pdf-viewer';
import PDFViewerLazy from '~/components/general/pdf-viewer/pdf-viewer-lazy';

import { EnvelopeRendererFileSelector } from '../envelope-editor/envelope-file-selector';
import { EnvelopeGenericPageRenderer } from '../envelope-editor/envelope-generic-page-renderer';

export type DocumentCertificateQRViewProps = {
  documentId: number;
  title: string;
  internalVersion: number;
  envelopeItems: (EnvelopeItem & { documentData: DocumentData })[];
  documentTeamUrl: string;
  recipientCount?: number;
  completedDate?: Date;
  token: string;
};

export const DocumentCertificateQRView = ({
  documentId,
  title,
  internalVersion,
  envelopeItems,
  documentTeamUrl,
  recipientCount = 0,
  completedDate,
  token,
}: DocumentCertificateQRViewProps) => {
  const { data: documentViaUser } = trpc.document.get.useQuery({
    documentId,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(() => !!documentViaUser);

  const formattedDate = completedDate
    ? DateTime.fromJSDate(completedDate).toLocaleString(DateTime.DATETIME_MED)
    : '';

  useEffect(() => {
    if (documentViaUser) {
      setIsDialogOpen(true);
    }
  }, [documentViaUser]);

  return (
    <div className="mx-auto w-full max-w-screen-md">
      {/* Dialog for internal document link */}
      {documentViaUser && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <Trans>Document found in your account</Trans>
              </DialogTitle>

              <DialogDescription>
                <Trans>
                  This document is available in your Davinci Sign account. You can view more
                  details, recipients, and audit logs there.
                </Trans>
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex flex-row justify-end gap-2">
              <Button asChild>
                <a
                  href={`${formatDocumentsPath(documentTeamUrl)}/${documentViaUser.envelopeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Trans>Go to document</Trans>
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {internalVersion === 2 ? (
        <EnvelopeRenderProvider
          version="current"
          envelope={{
            id: envelopeItems[0].envelopeId,
            status: DocumentStatus.COMPLETED,
            type: EnvelopeType.DOCUMENT,
          }}
          envelopeItems={envelopeItems}
          token={token}
        >
          <DocumentCertificateQrV2
            title={title}
            recipientCount={recipientCount}
            formattedDate={formattedDate}
            token={token}
          />
        </EnvelopeRenderProvider>
      ) : (
        <>
          <div className="flex w-full flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="space-y-1">
              <h1 className="font-medium text-xl">{title}</h1>
              <div className="flex flex-col gap-0.5 text-muted-foreground text-sm">
                <p>
                  <Trans>{recipientCount} recipients</Trans>
                </p>

                <p>
                  <Trans>Completed on {formattedDate}</Trans>
                </p>
              </div>
            </div>

            <EnvelopeDownloadDialog
              envelopeId={envelopeItems[0].envelopeId}
              envelopeStatus={DocumentStatus.COMPLETED}
              envelopeItems={envelopeItems}
              token={token}
              trigger={
                <Button type="button" variant="outline" className="w-fit">
                  <DownloadIcon className="mr-2 h-5 w-5" />
                  <Trans>Download</Trans>
                </Button>
              }
            />
          </div>

          <div className="mt-12 w-full">
            <PDFViewerLazy
              key={envelopeItems[0]?.id}
              data={getDocumentDataUrlForPdfViewer({
                envelopeId: envelopeItems[0]?.envelopeId,
                envelopeItemId: envelopeItems[0]?.id,
                documentDataId: envelopeItems[0]?.documentDataId,
                version: 'current',
                token,
                presignToken: undefined,
              })}
              scrollParentRef="window"
            />
          </div>
        </>
      )}
    </div>
  );
};

type DocumentCertificateQrV2Props = {
  title: string;
  recipientCount: number;
  formattedDate: string;
  token: string;
};

const DocumentCertificateQrV2 = ({
  title,
  recipientCount,
  formattedDate,
  token,
}: DocumentCertificateQrV2Props) => {
  const { envelopeItems } = useCurrentEnvelopeRender();

  return (
    <div className="flex min-h-screen flex-col items-start">
      <div className="flex w-full flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1">
          <h1 className="font-medium text-xl">{title}</h1>
          <div className="flex flex-col gap-0.5 text-muted-foreground text-sm">
            <p>
              <Trans>{recipientCount} recipients</Trans>
            </p>

            <p>
              <Trans>Completed on {formattedDate}</Trans>
            </p>
          </div>
        </div>

        <EnvelopeDownloadDialog
          envelopeId={envelopeItems[0].envelopeId}
          envelopeStatus={DocumentStatus.COMPLETED}
          envelopeItems={envelopeItems}
          token={token}
          trigger={
            <Button type="button" variant="outline" className="w-fit">
              <DownloadIcon className="mr-2 h-5 w-5" />
              <Trans>Download</Trans>
            </Button>
          }
        />
      </div>

      <div className="mt-8 flex w-full flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden transition-all">
          <EnvelopePdfViewer
            token={token}
            key={envelopeItems[0]?.id}
            scrollParentRef="window"
            className="h-full border-none p-0 pb-[13dvh]"
            errorMessage={PDF_VIEWER_ERROR_MESSAGES}
          />
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-10 w-full overflow-x-auto bg-background/80 py-4 shadow-xl backdrop-blur-sm transition-all duration-300">
          <div className="mx-auto flex h-full max-w-fit items-center justify-start gap-4 px-4 sm:px-6">
            <EnvelopeRendererFileSelector />

            <div className="flex flex-nowrap items-center gap-4">
              <EnvelopeGenericPageRenderer />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
