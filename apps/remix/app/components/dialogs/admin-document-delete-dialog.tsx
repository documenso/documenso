import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useNavigate } from 'react-router';

import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AdminDocumentDeleteDialogProps = {
  envelopeId: string;
};

export const AdminDocumentDeleteDialog = ({ envelopeId }: AdminDocumentDeleteDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();

  const [reason, setReason] = useState('');

  const { mutateAsync: deleteDocument, isPending: isDeletingDocument } =
    trpc.admin.document.delete.useMutation();

  const handleDeleteDocument = async () => {
    try {
      if (!reason) {
        return;
      }

      await deleteDocument({ id: envelopeId, reason });

      toast({
        title: _(msg`Document deleted`),
        description: _(msg`The Document has been deleted successfully.`),
        duration: 5000,
      });

      await navigate('/admin/documents');
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        variant: 'destructive',
        description: _(
          msg`We encountered an unknown error while attempting to delete your document. Please try again later.`,
        ),
      });
    }
  };

  return (
    <div>
      <div>
        <Alert
          className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row"
          variant="neutral"
        >
          <div>
            <AlertTitle>
              <Trans>Delete Document</Trans>
            </AlertTitle>
            <AlertDescription className="mr-2">
              <Trans>
                Delete the document. This action is irreversible so proceed with caution.
              </Trans>
            </AlertDescription>
          </div>

          <div className="flex-shrink-0">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trans>Delete Document</Trans>
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader className="space-y-4">
                  <DialogTitle>
                    <Trans>Delete Document</Trans>
                  </DialogTitle>

                  <Alert variant="destructive">
                    <AlertDescription className="selection:bg-red-100">
                      <Trans>This action is not reversible. Please be certain.</Trans>
                    </AlertDescription>
                  </Alert>
                </DialogHeader>

                <div>
                  <DialogDescription>
                    <Trans>To confirm, please enter the reason</Trans>
                  </DialogDescription>

                  <Input
                    className="mt-2"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <DialogFooter>
                  <Button
                    onClick={handleDeleteDocument}
                    loading={isDeletingDocument}
                    variant="destructive"
                    disabled={!reason}
                  >
                    <Trans>Delete document</Trans>
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Alert>
      </div>
    </div>
  );
};
