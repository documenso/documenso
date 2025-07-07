import { Trans } from '@lingui/react/macro';
import { LinkIcon } from 'lucide-react';

import type { DocumentAndSender } from '@documenso/lib/server-only/document/get-document-by-token';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';

export type DocumentSigningAttachmentsDialogProps = {
  document: DocumentAndSender;
};

export const DocumentSigningAttachmentsDialog = ({
  document,
}: DocumentSigningAttachmentsDialogProps) => {
  const attachments = document.attachments ?? [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trans>Attachments</Trans>
        </Button>
      </DialogTrigger>
      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Attachments</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>View all attachments for this document.</Trans>
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-2">
          {attachments.length === 0 && (
            <span className="text-muted-foreground text-sm">
              <Trans>No attachments available.</Trans>
            </span>
          )}
          {attachments.map((attachment, idx) => (
            <a
              key={attachment.id || idx}
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-muted/50 flex items-center gap-2 rounded px-2 py-1"
            >
              <LinkIcon className="h-4 w-4" />
              <span className="truncate">{attachment.label}</span>
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
