import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Download } from 'lucide-react';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import type { Document, DocumentData } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type ShareDocumentDownloadButtonProps = {
  document: Pick<Document, 'title'> & {
    documentData: DocumentData;
  };
};

export const ShareDocumentDownloadButton = ({ document }: ShareDocumentDownloadButtonProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const onDownloadClick = async () => {
    try {
      if (!document) {
        throw new Error('No document available');
      }

      await downloadPDF({ documentData: document.documentData, fileName: document.title });
    } catch (err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`An error occurred while downloading your document.`),
        variant: 'destructive',
      });
    }
  };

  return (
    <Button className="w-full" onClick={onDownloadClick}>
      <Download className="-ml-1 mr-2 inline h-4 w-4" />
      <Trans>Download</Trans>
    </Button>
  );
};
