import { lazy, useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { type DocumentData, DocumentStatus, type EnvelopeItem, EnvelopeType } from '@prisma/client';
import { DownloadIcon } from 'lucide-react';
import { DateTime } from 'luxon';

import {
  EnvelopeRenderProvider,
  useCurrentEnvelopeRender,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
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
import { PDFViewerLazy } from '@documenso/ui/primitives/pdf-viewer/lazy';

import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';

import { EnvelopeRendererFileSelector } from '../envelope-editor/envelope-file-selector';

const EnvelopeGenericPageRenderer = lazy(
  async () => import('~/components/general/envelope-editor/envelope-generic-page-renderer'),
);

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

      {internalVersion === 2 ? (
        <EnvelopeRenderProvider
          envelope={{
            envelopeItems,
            status: DocumentStatus.COMPLETED,
            type: EnvelopeType.DOCUMENT,
          }}
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
              <h1 className="text-xl font-medium">{title}</h1>
              <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
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
              key={envelopeItems[0].id}
              envelopeItem={envelopeItems[0]}
              token={token}
              version="signed"
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
  const { currentEnvelopeItem, envelopeItems } = useCurrentEnvelopeRender();

  return (
    <div className="flex min-h-screen flex-col items-start">
      <div className="flex w-full flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1">
          <h1 className="text-xl font-medium">{title}</h1>
          <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
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
        <EnvelopeRendererFileSelector className="mb-4 p-0" fields={[]} secondaryOverride={''} />

        <PDFViewerKonvaLazy renderer="preview" customPageRenderer={EnvelopeGenericPageRenderer} />
      </div>
    </div>
  );
};
