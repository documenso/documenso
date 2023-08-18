'use client';

import { HTMLAttributes } from 'react';

import { Download } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';

export type DownloadButtonProps = HTMLAttributes<HTMLButtonElement> & {
  disabled?: boolean;
  fileName?: string;
  document?: string;
};

export const DownloadButton = ({
  className,
  fileName,
  document,
  disabled,
  ...props
}: DownloadButtonProps) => {
  /**
   * Convert the document from base64 to a blob and download it.
   */
  const onDownloadClick = () => {
    if (!document) {
      return;
    }

    let decodedDocument = document;

    try {
      decodedDocument = atob(document);
    } catch (err) {
      // We're just going to ignore this error and try to download the document
      console.error(err);
    }

    const documentBytes = Uint8Array.from(decodedDocument.split('').map((c) => c.charCodeAt(0)));

    const blob = new Blob([documentBytes], {
      type: 'application/pdf',
    });

    const link = window.document.createElement('a');

    link.href = window.URL.createObjectURL(blob);
    link.download = fileName || 'document.pdf';

    link.click();

    window.URL.revokeObjectURL(link.href);
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={disabled || !document}
      onClick={onDownloadClick}
      {...props}
    >
      <Download className="mr-2 h-5 w-5" />
      Download
    </Button>
  );
};
