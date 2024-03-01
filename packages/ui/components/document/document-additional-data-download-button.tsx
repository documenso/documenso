'use client';

import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import { Download } from 'lucide-react';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import type { DocumentAdditionalData } from '@documenso/prisma/client';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { Button } from '../../primitives/button';

export type AdditionalDataDownloadButtonProps = HTMLAttributes<HTMLButtonElement> & {
  disabled?: boolean;
  docTitle: string;
  documentData: DocumentAdditionalData;
};

export const DocumentAdditionalDataDownloadButton = ({
  className,
  docTitle,
  documentData,
  disabled,
  children,
  ...props
}: AdditionalDataDownloadButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const onDownloadClick = async () => {
    try {
      setIsLoading(true);

      if (!documentData) {
        setIsLoading(false);
        return;
      }

      const originalName = docTitle.replace(/\.pdf$/i, '');
      const docType = documentData.contentType.toLowerCase();
      const fileName = `${originalName}_${docType}.pdf`;

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
      className={className}
      disabled={disabled || !documentData}
      onClick={onDownloadClick}
      loading={isLoading}
      {...props}
    >
      <Download className="mr-2 h-5 w-5" />
      {children}
    </Button>
  );
};
