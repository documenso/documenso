import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { FilePlus, Loader } from 'lucide-react';
import { useNavigate } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import type { TCreateTemplatePayloadSchema } from '@documenso/trpc/server/template-router/schema';
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

import { useCurrentTeam } from '~/providers/team';

type TemplateCreateDialogProps = {
  folderId?: string;
};

export const TemplateCreateDialog = ({ folderId }: TemplateCreateDialogProps) => {
  const navigate = useNavigate();

  const { user } = useSession();
  const { toast } = useToast();
  const { _ } = useLingui();

  const team = useCurrentTeam();

  const { mutateAsync: createTemplate } = trpc.template.createTemplate.useMutation();

  const [showTemplateCreateDialog, setShowTemplateCreateDialog] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const onFileDrop = async (files: File[]) => {
    const file = files[0];

    if (isUploadingFile) {
      return;
    }

    setIsUploadingFile(true);

    try {
      const payload = {
        title: file.name,
        folderId: folderId,
      } satisfies TCreateTemplatePayloadSchema;

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));
      formData.append('file', file);

      const { envelopeId: id } = await createTemplate(formData);

      toast({
        title: _(msg`Template document uploaded`),
        description: _(
          msg`Your document has been uploaded successfully. You will be redirected to the template page.`,
        ),
        duration: 5000,
      });

      setShowTemplateCreateDialog(false);

      await navigate(`${formatTemplatesPath(team.url)}/${id}/edit`);
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
          <Trans>Template (Legacy)</Trans>
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
