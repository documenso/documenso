import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { FilePlus, Loader } from 'lucide-react';
import { useNavigate } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { putPdfFile } from '@documenso/lib/universal/upload/put-file';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import { useToast } from '@documenso/ui/primitives/use-toast';

type TemplateCreateDialogProps = {
  teamId?: number;
  templateRootPath: string;
};

export const TemplateCreateDialog = ({ templateRootPath }: TemplateCreateDialogProps) => {
  const navigate = useNavigate();

  const { user } = useSession();
  const { toast } = useToast();
  const { _ } = useLingui();

  const { mutateAsync: createTemplate } = trpc.template.createTemplate.useMutation();

  const [showTemplateCreateDialog, setShowTemplateCreateDialog] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const onFileDrop = async (file: File) => {
    if (isUploadingFile) {
      return;
    }

    setIsUploadingFile(true);

    try {
      const response = await putPdfFile(file);

      const { id } = await createTemplate({
        title: file.name,
        templateDocumentDataId: response.id,
      });

      toast({
        title: _(msg`Template document uploaded`),
        description: _(
          msg`Your document has been uploaded successfully. You will be redirected to the template page.`,
        ),
        duration: 5000,
      });

      setShowTemplateCreateDialog(false);

      await navigate(`${templateRootPath}/${id}/edit`);
    } catch {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`Please try again later.`),
        variant: 'destructive',
      });

      setIsUploadingFile(false);
    }
  };

  return (
    <Dialog
      open={showTemplateCreateDialog}
      onOpenChange={(value) => !isUploadingFile && setShowTemplateCreateDialog(value)}
    >
      <DialogTrigger asChild>
        <Button className="cursor-pointer" disabled={!user.emailVerified}>
          <FilePlus className="-ml-1 mr-2 h-4 w-4" />
          <Trans>New Template</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent className="w-full max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <Trans>New Template</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Templates allow you to quickly generate documents with pre-filled recipients and
              fields.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <DocumentDropzone className="h-[40vh]" onDrop={onFileDrop} type="template" />

          {isUploadingFile && (
            <div className="bg-background/50 absolute inset-0 flex items-center justify-center rounded-lg">
              <Loader className="text-muted-foreground h-12 w-12 animate-spin" />
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isUploadingFile}>
              <Trans>Close</Trans>
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
