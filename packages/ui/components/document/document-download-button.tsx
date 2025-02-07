import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { DocumentData } from '@prisma/client';
import { Download } from 'lucide-react';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { Button } from '../../primitives/button';

export type DownloadButtonProps = HTMLAttributes<HTMLButtonElement> & {
  disabled?: boolean;
  fileName?: string;
  documentData?: DocumentData;
};

export const DocumentDownloadButton = ({
  className,
  fileName,
  documentData,
  disabled,
  ...props
}: DownloadButtonProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);

  const onDownloadClick = async () => {
    try {
      setIsLoading(true);

      if (!documentData) {
        setIsLoading(false);
        return;
      }

      await downloadPDF({ documentData, fileName }).then(() => {
        setIsLoading(false);
      });
    } catch (err) {
      setIsLoading(false);

      toast({
        title: _('Something went wrong'),
        description: _('An error occurred while downloading your document.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={disabled || !documentData}
      onClick={onDownloadClick}
      loading={isLoading}
      {...props}
    >
      {!isLoading && <Download className="mr-2 h-5 w-5" />}
      <Trans>Download</Trans>
    </Button>
  );
};
