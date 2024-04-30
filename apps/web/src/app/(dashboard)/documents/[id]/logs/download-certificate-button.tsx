'use client';

import { DownloadIcon } from 'lucide-react';

import { DocumentStatus } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DownloadCertificateButtonProps = {
  className?: string;
  documentId: number;
  documentStatus: DocumentStatus;
};

export const DownloadCertificateButton = ({
  className,
  documentId,
  documentStatus,
}: DownloadCertificateButtonProps) => {
  const { toast } = useToast();

  const { mutateAsync: downloadCertificate, isLoading } =
    trpc.document.downloadCertificate.useMutation();

  const onDownloadCertificatesClick = async () => {
    try {
      const { url } = await downloadCertificate({ documentId });

      const iframe = Object.assign(document.createElement('iframe'), {
        src: url,
      });

      Object.assign(iframe.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '0',
        height: '0',
      });

      const onLoaded = () => {
        if (iframe.contentDocument?.readyState === 'complete') {
          iframe.contentWindow?.print();

          iframe.contentWindow?.addEventListener('afterprint', () => {
            document.body.removeChild(iframe);
          });
        }
      };

      // When the iframe has loaded, print the iframe and remove it from the dom
      iframe.addEventListener('load', onLoaded);

      document.body.appendChild(iframe);

      onLoaded();
    } catch (error) {
      console.error(error);

      toast({
        title: 'Something went wrong',
        description: 'Sorry, we were unable to download the certificate. Please try again later.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      className={cn('w-full sm:w-auto', className)}
      loading={isLoading}
      variant="outline"
      disabled={documentStatus !== DocumentStatus.COMPLETED}
      onClick={() => void onDownloadCertificatesClick()}
    >
      {!isLoading && <DownloadIcon className="mr-1.5 h-4 w-4" />}
      Download Certificate
    </Button>
  );
};
