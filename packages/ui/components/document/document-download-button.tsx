'use client';

import { HTMLAttributes, useState } from 'react';

import { Download } from 'lucide-react';

import { getFile } from '@documenso/lib/universal/upload/get-file';
import { DocumentData } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

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
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);

  const onDownloadClick = async () => {
    try {
      setIsLoading(true);

      if (!documentData) {
        return;
      }

      const bytes = await getFile(documentData);

      const blob = new Blob([bytes], {
        type: 'application/pdf',
      });

      const link = window.document.createElement('a');

      link.href = window.URL.createObjectURL(blob);
      link.download = fileName || 'document.pdf';

      link.click();

      window.URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while downloading your document.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
