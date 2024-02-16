import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

type DocumentHistoryDialogProps = {
  id: number;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DocumentHistoryDialog = ({ id, open, onOpenChange }: DocumentHistoryDialogProps) => {
  const { data: auditLogs, isLoading } =
    trpcReact.document.getDocumentAuditLogsByDocumentId.useQuery({ id });
  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
        </DialogHeader>

        {!auditLogs || isLoading ? (
          <div>loading...</div>
        ) : (
          <div className="mx-auto -mt-4 flex w-full max-w-screen-xl flex-col px-4 md:px-8">
            <h1>Document Audit Logs ({auditLogs.length})</h1>
            <ul>
              {auditLogs.map((log) => (
                <li key={log.id}>
                  {log.createdAt.toString()}: {log.type} by {log.email}
                </li>
              ))}
            </ul>
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
              Download Certificate
            </Button>

            <Button type="button" disabled={isLoading} className="flex-1">
              Save as PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
