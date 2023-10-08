'use client';

import { useState } from 'react';

import { useSession } from 'next-auth/react';

import { base64 } from '@documenso/lib/universal/base64';
import { getFile } from '@documenso/lib/universal/upload/get-file';
import { DocumentData, Template } from '@documenso/prisma/client';
import TemplatePreviewComponent from '@documenso/ui/components/template/template-preview';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DataTableTitleProps = {
  row: Template;
};

export const DataTableTitle = ({ row }: DataTableTitleProps) => {
  const { data: session } = useSession();

  const [isFetchingDocumentFile, setIsFetchingDocumentFile] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [documentFile, setDocumentFile] = useState<string | null>(null);

  const { toast } = useToast();

  const onShowDocumentClick = async (templateField: DocumentData) => {
    if (isFetchingDocumentFile) {
      return;
    }

    setIsFetchingDocumentFile(true);

    try {
      const data = await getFile(templateField);

      setDocumentFile(base64.encode(data));

      setShowDocumentDialog(true);
    } catch {
      toast({
        title: 'Something went wrong.',
        description: 'We were unable to retrieve the document at this time. Please try again.',
        variant: 'destructive',
        duration: 7500,
      });
    }

    setIsFetchingDocumentFile(false);
  };

  const onTitleClick = async () => {
    // TODO: Trying to get the preview quickly, will refactor later on
    await onShowDocumentClick((row as any).TemplateData);
  };

  if (!session) {
    return null;
  }

  return (
    <>
      <span
        onClick={onTitleClick}
        className="block max-w-[10rem] cursor-pointer truncate font-medium hover:underline md:max-w-[20rem]"
      >
        {row.title}
      </span>

      {/* TODO: Take this out of here */}
      {/* BUG: Scroll get's stuck for a split second for some reason */}
      <TemplatePreviewComponent
        document={documentFile ?? ''}
        open={showDocumentDialog}
        onOpenChange={setShowDocumentDialog}
      />
    </>
  );
};
