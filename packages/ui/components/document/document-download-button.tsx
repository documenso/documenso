'use client';

import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import { Download } from 'lucide-react';

import { downloadFile } from '@documenso/lib/client-only/download-pdf';
import type { DocumentData } from '@documenso/prisma/client';

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

  const onDownloadClick = async () => {
    setIsLoading(true);

    if (!documentData) {
      return;
    }

    await downloadFile({ documentData, fileName }).then(() => {
      setIsLoading(false);
    });
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
