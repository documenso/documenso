import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

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

export type DocumentRenameDialogProps = {
  id: number;
  initialTitle: string;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DocumentRenameDialog = ({
  id,
  initialTitle,
  open,
  onOpenChange,
}: DocumentRenameDialogProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();
  const trpcUtils = trpcReact.useUtils();

  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
    }
  }, [open, initialTitle]);

  const { mutate: updateDocument, isPending } = trpcReact.document.update.useMutation({
    onSuccess: async () => {
      toast({
        title: _(msg`Document Renamed`),
        description: _(msg`Your document has been successfully renamed.`),
        duration: 5000,
      });

      await trpcUtils.document.findDocumentsInternal.invalidate();

      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`This document could not be renamed at this time. Please try again.`),
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

    updateDocument({
      documentId: id,
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
            <Trans>Rename Document</Trans>
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <Label htmlFor="title" className="sr-only">
            <Trans>Title</Trans>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPending}
            maxLength={DOCUMENT_TITLE_MAX_LENGTH}
            className="w-full"
            autoFocus
          />
        </div>

        <DialogFooter>
          <div className="flex w-full flex-1 flex-nowrap gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="button"
              disabled={isPending || !trimmedTitle || trimmedTitle === initialTitle}
              loading={isPending}
              onClick={() => void onRename()}
              className="flex-1"
            >
              <Trans>Rename</Trans>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
