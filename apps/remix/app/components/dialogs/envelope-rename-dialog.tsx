import { useEffect, useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';

import { trpc as trpcReact } from '@documenso/trpc/react';
import { DOCUMENT_TITLE_MAX_LENGTH } from '@documenso/trpc/server/document-router/schema';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type EnvelopeRenameDialogProps = {
  id: string;
  initialTitle: string;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onSuccess?: () => Promise<void>;
  envelopeType?: 'document' | 'template';
};

export const EnvelopeRenameDialog = ({
  id,
  initialTitle,
  open,
  onOpenChange,
  onSuccess,
  envelopeType = 'document',
}: EnvelopeRenameDialogProps) => {
  const { toast } = useToast();
  const { t } = useLingui();

  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
    }
  }, [open, initialTitle]);

  const isTemplate = envelopeType === 'template';

  const { mutate: updateEnvelope, isPending } = trpcReact.envelope.update.useMutation({
    onSuccess: async () => {
      await onSuccess?.();

      toast({
        title: isTemplate ? t`Template Renamed` : t`Document Renamed`,
        description: isTemplate
          ? t`Your template has been successfully renamed.`
          : t`Your document has been successfully renamed.`,
        duration: 5000,
      });

      onOpenChange(false);
    },
    onError: () => {
      toast({
        description: t`Something went wrong. Please try again.`,
        variant: 'destructive',
        duration: 7500,
      });
    },
  });

  const trimmedTitle = title.trim();

  const onRename = () => {
    if (!trimmedTitle || trimmedTitle === initialTitle) {
      onOpenChange(false);
      return;
    }

    updateEnvelope({
      envelopeId: id,
      data: {
        title: trimmedTitle,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isTemplate ? <Trans>Rename Template</Trans> : <Trans>Rename Document</Trans>}
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <Label htmlFor="title" className="sr-only">
            <Trans>Title</Trans>
          </Label>
          <Input
            id="title"
            value={title}
            placeholder={t`Enter a new title`}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPending}
            maxLength={DOCUMENT_TITLE_MAX_LENGTH}
            className="w-full"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </Button>

          <Button
            type="button"
            disabled={isPending || !trimmedTitle || trimmedTitle === initialTitle}
            loading={isPending}
            onClick={() => void onRename()}
          >
            <Trans>Rename</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
