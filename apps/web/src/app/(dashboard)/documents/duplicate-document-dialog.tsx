import { useRouter } from 'next/navigation';

import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import type { Team } from '@documenso/prisma/client';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { useToast } from '@documenso/ui/primitives/use-toast';

type DuplicateDocumentDialogProps = {
  id: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  team?: Pick<Team, 'id' | 'url'>;
};

export const DuplicateDocumentDialog = ({
  id,
  open,
  onOpenChange,
  team,
}: DuplicateDocumentDialogProps) => {
  const router = useRouter();
  const { toast } = useToast();

  const { data: document, isLoading } = trpcReact.document.getDocumentById.useQuery({
    id,
    teamId: team?.id,
  });

  const documentData = document?.documentData
    ? {
        ...document.documentData,
        data: document.documentData.initialData,
      }
    : undefined;

  const documentsPath = formatDocumentsPath(team?.url);

  const { mutateAsync: duplicateDocument, isLoading: isDuplicateLoading } =
    trpcReact.document.duplicateDocument.useMutation({
      onSuccess: (newId) => {
        router.push(`${documentsPath}/${newId}/edit`);

        toast({
          title: 'Document Duplicated',
          description: 'Your document has been successfully duplicated.',
          duration: 5000,
        });

        onOpenChange(false);
      },
    });

  const onDuplicate = async () => {
    try {
      await duplicateDocument({ id, teamId: team?.id });
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'This document could not be duplicated at this time. Please try again.',
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate</DialogTitle>
        </DialogHeader>
        {!documentData || isLoading ? (
          <div className="mx-auto -mt-4 flex w-full max-w-screen-xl flex-col px-4 md:px-8">
            <h1 className="mt-4 grow-0 truncate text-2xl font-semibold md:text-3xl">
              Loading Document...
            </h1>
          </div>
        ) : (
          <div className="p-2 [&>div]:h-[50vh] [&>div]:overflow-y-scroll  ">
            <LazyPDFViewer key={document?.id} documentData={documentData} />
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
              Cancel
            </Button>

            <Button
              type="button"
              disabled={isDuplicateLoading || isLoading}
              loading={isDuplicateLoading}
              onClick={onDuplicate}
              className="flex-1"
            >
              Duplicate
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
