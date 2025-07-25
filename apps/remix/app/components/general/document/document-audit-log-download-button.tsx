import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DownloadIcon } from 'lucide-react';

import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentAuditLogDownloadButtonProps = {
  className?: string;
  documentId: number;
};

export const DocumentAuditLogDownloadButton = ({
  className,
  documentId,
}: DocumentAuditLogDownloadButtonProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const { mutateAsync: downloadAuditLogs, isPending } =
    trpc.document.downloadAuditLogs.useMutation();

  const onDownloadAuditLogsClick = async () => {
    try {
      const { url } = await downloadAuditLogs({ documentId });

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
          const style = iframe.contentDocument.createElement('style');
          style.textContent = `
            @media print {
              table {
                width: 100% !important;
                table-layout: fixed !important;
                font-size: 10px !important;
              }
              th, td {
                padding: 4px !important;
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
                white-space: normal !important;
                line-height: 1.2 !important;
              }
              th:nth-child(1) { width: 15%; }
              th:nth-child(2) { width: 20%; }
              th:nth-child(3) { width: 25%; }
              th:nth-child(4) { width: 20%; }
              th:nth-child(5) { width: 20%; }
            }
          `;
          iframe.contentDocument.head.appendChild(style);

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
        title: _(msg`Something went wrong`),
        description: _(
          msg`Sorry, we were unable to download the audit logs. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      className={cn('w-full sm:w-auto', className)}
      loading={isPending}
      onClick={() => void onDownloadAuditLogsClick()}
    >
      {!isPending && <DownloadIcon className="mr-1.5 h-4 w-4" />}
      <Trans>Download Audit Logs</Trans>
    </Button>
  );
};
