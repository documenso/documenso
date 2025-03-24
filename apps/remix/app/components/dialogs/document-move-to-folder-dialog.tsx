'use client';

import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { FolderIcon, HomeIcon, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DocumentMoveToFolderDialogProps = {
  documentId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onMoveDocument?: (folderId: string | null) => Promise<void>;
  currentFolderId?: string | null;
};

export const DocumentMoveToFolderDialog = ({
  documentId,
  open,
  onOpenChange,
  onSuccess,
  onMoveDocument,
  currentFolderId,
}: DocumentMoveToFolderDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: folders, isLoading: isFoldersLoading } = trpc.folder.findFolders.useQuery(
    {
      parentId: null,
    },
    {
      enabled: open,
      retry: false,
    },
  );

  const { mutateAsync: moveDocumentToFolder } = trpc.folder.moveDocumentToFolder.useMutation();

  useEffect(() => {
    if (!open) {
      setSelectedFolderId(null);
      setIsSubmitting(false);
    } else {
      // Initialize with current folder if available
      setSelectedFolderId(currentFolderId || null);
    }
  }, [open, currentFolderId]);

  const handleMoveDocument = async () => {
    try {
      setIsSubmitting(true);

      if (onMoveDocument) {
        // Use the parent component's move document function if provided
        await onMoveDocument(selectedFolderId);
      } else {
        // Otherwise use the default implementation
        await moveDocumentToFolder({
          documentId,
          folderId: selectedFolderId,
        });
      }

      toast({
        title: _(msg`Document moved`),
        description: _(msg`The document has been moved successfully.`),
        variant: 'default',
      });

      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }

      // If the document was moved to a folder, navigate to that folder
      if (selectedFolderId) {
        void navigate(`/documents?folderId=${selectedFolderId}`);
      } else {
        void navigate('/documents');
      }
    } catch (error) {
      console.error('Move document error:', error);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while moving the document.`),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Move Document to Folder</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Select a folder to move this document to.</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <label htmlFor="folder" className="text-sm font-medium">
              <Trans>Folder</Trans>
            </label>

            {isFoldersLoading ? (
              <div className="flex h-10 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant={selectedFolderId === null ? 'default' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => setSelectedFolderId(null)}
                  >
                    <HomeIcon className="mr-2 h-4 w-4" />
                    <Trans>Root (No Folder)</Trans>
                  </Button>

                  {folders?.data.map((folder) => (
                    <Button
                      key={folder.id}
                      type="button"
                      variant={selectedFolderId === folder.id ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => setSelectedFolderId(folder.id)}
                    >
                      <FolderIcon className="mr-2 h-4 w-4" />
                      {folder.name}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            <Trans>Cancel</Trans>
          </Button>

          <Button onClick={handleMoveDocument} disabled={isSubmitting || isFoldersLoading}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Trans>Move</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
