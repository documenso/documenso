'use client';

import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import { Download } from 'lucide-react';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import type { DocumentData } from '@documenso/prisma/client';
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
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
        title: 'Something went wrong',
        description: 'An error occurred while downloading your document.',
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
      <Download className="mr-2 h-5 w-5" />
      Download
    </Button>
  );
};
