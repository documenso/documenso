import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Download } from 'lucide-react';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import type { DocumentData } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type ShareDocumentDownloadButtonProps = {
  title: string;
  documentData: DocumentData;
};

export const ShareDocumentDownloadButton = ({
  title,
  documentData,
}: ShareDocumentDownloadButtonProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [isDownloading, setIsDownloading] = useState(false);

  const onDownloadClick = async () => {
    try {
      setIsDownloading(true);

      await new Promise((resolve) => {
        setTimeout(resolve, 4000);
      });

      await downloadPDF({ documentData, fileName: title });
    } catch (err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`An error occurred while downloading your document.`),
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button loading={isDownloading} onClick={onDownloadClick}>
      {!isDownloading && <Download className="mr-2 h-4 w-4" />}
      <Trans>Download</Trans>
    </Button>
  );
};
