import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { DocumentStatus } from '@prisma/client';
import { DownloadIcon } from 'lucide-react';

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
      const { pdfData, filename } = await downloadCertificate({ documentId });

      const byteCharacters = atob(pdfData);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
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
