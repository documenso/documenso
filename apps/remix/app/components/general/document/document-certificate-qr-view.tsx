import { useEffect, useState } from 'react';

import { Plural, Trans } from '@lingui/react/macro';
import type { DocumentData, EnvelopeItem } from '@prisma/client';
import { DateTime } from 'luxon';

import { EnvelopeRenderProvider } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import PDFViewerKonvaLazy from '@documenso/ui/components/pdf-viewer/pdf-viewer-konva-lazy';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { PDFViewer } from '@documenso/ui/primitives/pdf-viewer';

import { EnvelopeRendererFileSelector } from '../envelope-editor/envelope-file-selector';
import EnvelopeGenericPageRenderer from '../envelope-editor/envelope-generic-page-renderer';
import { ShareDocumentDownloadButton } from '../share-document-download-button';

export type DocumentCertificateQRViewProps = {
  documentId: number;
  title: string;
  internalVersion: number;
  envelopeItems: (EnvelopeItem & { documentData: DocumentData })[];
  documentTeamUrl: string;
  recipientCount?: number;
  completedDate?: Date;
};

export const DocumentCertificateQRView = ({
  documentId,
  title,
  internalVersion,
  envelopeItems,
  documentTeamUrl,
  recipientCount = 0,
  completedDate,
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
                  This document is available in your Documenso account. You can view more details,
                  recipients, and audit logs there.
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

      <div className="flex w-full flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1">
          <h1 className="text-xl font-medium">{title}</h1>
          <div className="text-muted-foreground flex flex-col gap-0.5 text-sm">
            <p>
              <Plural one="1 Recipient" other="# Recipients" value={recipientCount} />
            </p>

            <p>
              <Trans>Completed on {formattedDate}</Trans>
            </p>
          </div>
        </div>

        <ShareDocumentDownloadButton title={title} documentData={envelopeItems[0].documentData} />
      </div>

      <div className="mt-12 w-full">
        {internalVersion === 2 ? (
          <EnvelopeRenderProvider envelope={{ envelopeItems }}>
            <EnvelopeRendererFileSelector className="mb-4 p-0" fields={[]} secondaryOverride={''} />

            <PDFViewerKonvaLazy customPageRenderer={EnvelopeGenericPageRenderer} />
          </EnvelopeRenderProvider>
        ) : (
          <>
            <PDFViewer key={envelopeItems[0].id} documentData={envelopeItems[0].documentData} />
          </>
        )}
      </div>
    </div>
  );
};
