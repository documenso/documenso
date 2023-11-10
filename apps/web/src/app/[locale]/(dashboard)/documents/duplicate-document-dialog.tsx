import { useRouter } from 'next/navigation';

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
};

export const DuplicateDocumentDialog = ({
  id,
  open,
  onOpenChange,
}: DuplicateDocumentDialogProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading } = trpcReact.document.getDocumentById.useQuery({
    id,
  });
  const { mutateAsync: duplicateDocument, isLoading: isDuplicateLoading } =
    trpcReact.document.duplicateDocument.useMutation({
      onSuccess: (newId) => {
        router.push(`/documents/${newId}`);
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
      await duplicateDocument({ id });
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
        {!data?.documentData || isLoading ? (
          <div className="mx-auto -mt-4 flex w-full max-w-screen-xl flex-col px-4 md:px-8">
            <h1 className="mt-4 grow-0 truncate text-2xl font-semibold md:text-3xl">
              Loading Document...
            </h1>
          </div>
        ) : (
          <div className="p-2 [&>div]:h-[50vh] [&>div]:overflow-y-scroll  ">
            <LazyPDFViewer key={data?.documentMeta?.documentId} documentData={data?.documentData} />
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
