'use client';

import { useState } from 'react';

import { FileSearch } from 'lucide-react';

import type { DocumentData } from '@documenso/prisma/client';
import DocumentDialog from '@documenso/ui/components/document/document-dialog';
import type { ButtonProps } from '@documenso/ui/primitives/button';
import { Button } from '@documenso/ui/primitives/button';

export type DocumentPreviewButtonProps = {
  className?: string;
  documentData: DocumentData;
} & ButtonProps;

export const DocumentPreviewButton = ({
  className,
  documentData,
  ...props
}: DocumentPreviewButtonProps) => {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <Button
        className={className}
        variant="outline"
        onClick={() => setShowDialog((visible) => !visible)}
        {...props}
      >
        <FileSearch className="mr-2 h-5 w-5" strokeWidth={1.7} />
        View Original Document
      </Button>

      <DocumentDialog documentData={documentData} open={showDialog} onOpenChange={setShowDialog} />
    </>
  );
};
