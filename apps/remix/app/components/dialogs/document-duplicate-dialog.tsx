import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useNavigate } from 'react-router';

import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { PDFViewer } from '@documenso/ui/primitives/pdf-viewer';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

type DocumentDuplicateDialogProps = {
  id: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DocumentDuplicateDialog = ({
  id,
  open,
  onOpenChange,
}: DocumentDuplicateDialogProps) => {
  const navigate = useNavigate();

  const { toast } = useToast();
  const { _ } = useLingui();

  const team = useCurrentTeam();

  const { data: document, isLoading } = trpcReact.document.getDocumentById.useQuery(
    {
      documentId: id,
    },
    {
      enabled: open === true,
    },
  );

  const documentData = document?.documentData
    ? {
        ...document.documentData,
        data: document.documentData.initialData,
      }
    : undefined;

  const documentsPath = formatDocumentsPath(team?.url);

  const { mutateAsync: duplicateDocument, isPending: isDuplicateLoading } =
    trpcReact.document.duplicateDocument.useMutation({
      onSuccess: async ({ documentId }) => {
        toast({
          title: _(msg`Document Duplicated`),
          description: _(msg`Your document has been successfully duplicated.`),
          duration: 5000,
        });

        await navigate(`${documentsPath}/${documentId}/edit`);
        onOpenChange(false);
      },
    });

  const onDuplicate = async () => {
    try {
      await duplicateDocument({ documentId: id });
    } catch {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`This document could not be duplicated at this time. Please try again.`),
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Duplicate</Trans>
          </DialogTitle>
        </DialogHeader>
        {!documentData || isLoading ? (
          <div className="mx-auto -mt-4 flex w-full max-w-screen-xl flex-col px-4 md:px-8">
            <h1 className="mt-4 grow-0 truncate text-2xl font-semibold md:text-3xl">
              <Trans>Loading Document...</Trans>
            </h1>
          </div>
        ) : (
          <div className="p-2 [&>div]:h-[50vh] [&>div]:overflow-y-scroll">
            <PDFViewer key={document?.id} documentData={documentData} />
          </div>
        )}

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
              disabled={isDuplicateLoading || isLoading}
              loading={isDuplicateLoading}
              onClick={onDuplicate}
              className="flex-1"
            >
              <Trans>Duplicate</Trans>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
