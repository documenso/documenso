import { type ReactNode, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useNavigate, useParams } from 'react-router';

import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';
import { putPdfFile } from '@documenso/lib/universal/upload/put-file';
import { formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useOptionalCurrentTeam } from '~/providers/team';

export interface TemplateDropZoneWrapperProps {
  children: ReactNode;
  className?: string;
}

export const TemplateDropZoneWrapper = ({ children, className }: TemplateDropZoneWrapperProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { folderId } = useParams();

  const team = useOptionalCurrentTeam();

  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);

  const { mutateAsync: createTemplate } = trpc.template.createTemplate.useMutation();

  const onFileDrop = async (file: File) => {
    try {
      setIsLoading(true);

      const response = await putPdfFile(file);

      const { id } = await createTemplate({
        title: file.name,
        templateDocumentDataId: response.id,
        folderId: folderId ?? undefined,
      });

      toast({
        title: _(msg`Template document uploaded`),
        description: _(
          msg`Your document has been uploaded successfully. You will be redirected to the template page.`,
        ),
        duration: 5000,
      });

      await navigate(
        folderId
          ? `${formatTemplatesPath(team?.url)}/f/${folderId}/${id}/edit`
          : `${formatTemplatesPath(team?.url)}/${id}/edit`,
      );
    } catch {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`Please try again later.`),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onFileDropRejected = () => {
    toast({
      title: _(msg`Your document failed to upload.`),
      description: _(msg`File cannot be larger than ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB`),
      duration: 5000,
      variant: 'destructive',
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    //disabled: isUploadDisabled,
    multiple: false,
    maxSize: megabytesToBytes(APP_DOCUMENT_UPLOAD_SIZE_LIMIT),
    onDrop: ([acceptedFile]) => {
      if (acceptedFile) {
        void onFileDrop(acceptedFile);
      }
    },
    onDropRejected: () => {
      void onFileDropRejected();
    },
    noClick: true,
    noDragEventsBubbling: true,
  });

  return (
    <div {...getRootProps()} className={cn('relative min-h-screen', className)}>
      <input {...getInputProps()} />
      {children}

      {isDragActive && (
        <div className="bg-muted/60 fixed left-0 top-0 z-[9999] h-full w-full backdrop-blur-[4px]">
          <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center">
            <h2 className="text-foreground text-2xl font-semibold">
              <Trans>Upload Template</Trans>
            </h2>

            <p className="text-muted-foreground text-md mt-4">
              <Trans>Drag and drop your PDF file here</Trans>
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="bg-muted/30 absolute inset-0 z-50 backdrop-blur-[2px]">
          <div className="pointer-events-none flex h-1/2 w-full flex-col items-center justify-center">
            <Loader className="text-primary h-12 w-12 animate-spin" />
            <p className="text-foreground mt-8 font-medium">
              <Trans>Uploading document...</Trans>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
