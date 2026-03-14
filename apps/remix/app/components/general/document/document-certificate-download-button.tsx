import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { DocumentStatus } from '@prisma/client';
import { DownloadIcon } from 'lucide-react';

import { downloadFile } from '@documenso/lib/client-only/download-file';
import { base64 } from '@documenso/lib/universal/base64';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentCertificateDownloadButtonProps = {
  className?: string;
  documentId: number;
  documentStatus: DocumentStatus;
};

export const DocumentCertificateDownloadButton = ({
  className,
  documentId,
  documentStatus,
}: DocumentCertificateDownloadButtonProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const { mutateAsync: downloadCertificate, isPending } =
    trpc.document.downloadCertificate.useMutation();

  const onDownloadCertificatesClick = async () => {
    try {
      const { data, envelopeTitle } = await downloadCertificate({ documentId });

      const buffer = new Uint8Array(base64.decode(data));
      const blob = new Blob([buffer], { type: 'application/pdf' });

      downloadFile({
        data: blob,
        filename: `${envelopeTitle} - Certificate.pdf`,
      });
    } catch (error) {
      console.error(error);

      toast({
        title: _(msg`Something went wrong`),
        description: _(
          msg`Sorry, we were unable to download the certificate. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      className={cn('w-full sm:w-auto', className)}
      loading={isPending}
      variant="outline"
      disabled={!isDocumentCompleted(documentStatus)}
      onClick={() => void onDownloadCertificatesClick()}
    >
      {!isPending && <DownloadIcon className="mr-1.5 h-4 w-4" />}
      <Trans>Download Certificate</Trans>
    </Button>
  );
};
