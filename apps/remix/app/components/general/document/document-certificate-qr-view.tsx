import { useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import type { DocumentData } from '@prisma/client';
import { DateTime } from 'luxon';

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
import { PDFViewer } from '@documenso/ui/primitives/pdf-viewer';

import { ShareDocumentDownloadButton } from '../share-document-download-button';

export type DocumentCertificateQRViewProps = {
  documentId: number;
  title: string;
  documentData: DocumentData;
  password?: string | null;
  recipientCount?: number;
  completedDate?: Date;
};

export const DocumentCertificateQRView = ({
  documentId,
  title,
  documentData,
  password,
  recipientCount = 0,
  completedDate,
}: DocumentCertificateQRViewProps) => {
  const { data: documentUrl } = trpc.shareLink.getDocumentInternalUrlForQRCode.useQuery({
    documentId,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(() => !!documentUrl);

  const formattedDate = completedDate
    ? DateTime.fromJSDate(completedDate).toLocaleString(DateTime.DATETIME_MED)
    : '';

  useEffect(() => {
    if (documentUrl) {
      setIsDialogOpen(true);
    }
  }, [documentUrl]);

  return (
    <div className="mx-auto w-full max-w-screen-md">
      {/* Dialog for internal document link */}
      {documentUrl && (
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
                <a href={documentUrl} target="_blank" rel="noopener noreferrer">
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
              <Trans>{recipientCount} recipients</Trans>
            </p>

            <p>
              <Trans>Completed on {formattedDate}</Trans>
            </p>
          </div>
        </div>

        <ShareDocumentDownloadButton title={title} documentData={documentData} />
      </div>

      <div className="mt-12 w-full">
        <PDFViewer key={documentData.id} documentData={documentData} password={password} />
      </div>
    </div>
  );
};
