'use client';

import { DownloadIcon } from 'lucide-react';

import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DownloadAuditLogButtonProps = {
  className?: string;
  teamId?: number;
  documentId: number;
};

export const DownloadAuditLogButton = ({
  className,
  teamId,
  documentId,
}: DownloadAuditLogButtonProps) => {
  const { toast } = useToast();

  const { mutateAsync: downloadAuditLogs, isLoading } =
    trpc.document.downloadAuditLogs.useMutation();

  const onDownloadAuditLogsClick = async () => {
    try {
      const { url } = await downloadAuditLogs({ teamId, documentId });

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
        title: 'დაფიქსირდა ხარვეზი',
        description:
          'აუდიტის ჩამოტვირთვისას დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      className={cn('w-full sm:w-auto', className)}
      loading={isLoading}
      onClick={() => void onDownloadAuditLogsClick()}
    >
      {!isLoading && <DownloadIcon className="mr-1.5 h-4 w-4" />}
      აუდიტის ჩამოტვირთვა
    </Button>
  );
};
