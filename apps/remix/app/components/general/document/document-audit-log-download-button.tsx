import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DownloadIcon } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

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
  const [isPending, setIsPending] = useState(false);
  const team = useCurrentTeam();

  const onDownloadAuditLogsClick = async () => {
    setIsPending(true);

    try {
      const response = await fetch(`/api/t/${team.url}/download/audit-logs/${documentId}`);

      if (!response.ok) {
        throw new Error('Failed to download certificate');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      const filename =
        contentDisposition?.split('filename="')[1]?.split('"')[0] ||
        `document_${documentId}_audit_logs.pdf`;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Audit logs download error:', error);

      toast({
        title: _(msg`Something went wrong`),
        description: _(
          msg`Sorry, we were unable to download the audit logs. Please try again later.`,
        ),
        variant: 'destructive',
      });
    } finally {
      setIsPending(false);
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
