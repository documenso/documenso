import { Trans } from '@lingui/react/macro';
import { ExternalLink, PaperclipIcon } from 'lucide-react';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';

export type DocumentSigningAttachmentsPopoverProps = {
  envelopeId: string;
  token: string;
  trigger?: React.ReactNode;
};

export const DocumentSigningAttachmentsPopover = ({
  envelopeId,
  token,
  trigger,
}: DocumentSigningAttachmentsPopoverProps) => {
  const { data: attachments } = trpc.envelope.attachment.find.useQuery({
    envelopeId,
    token,
  });

  if (!attachments || attachments.data.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <PaperclipIcon className="h-4 w-4" />
            <span>
              <Trans>Attachments</Trans>{' '}
              {attachments && attachments.data.length > 0 && (
                <span className="ml-1">({attachments.data.length})</span>
              )}
            </span>
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent className="w-96" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">
              <Trans>Attachments</Trans>
            </h4>
            <p className="text-muted-foreground mt-1 text-sm">
              <Trans>Documents and resources related to this envelope.</Trans>
            </p>
          </div>

          <div className="space-y-2">
            {attachments?.data.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.data}
                title={attachment.data}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border hover:bg-muted/50 group flex items-center justify-between rounded-md border px-3 py-2.5 transition duration-200"
              >
                <div className="flex flex-1 items-center gap-2.5">
                  <div className="bg-muted rounded p-2">
                    <PaperclipIcon className="h-4 w-4" />
                  </div>

                  <span className="text-muted-foreground hover:text-foreground block truncate text-sm underline">
                    {attachment.label}
                  </span>
                </div>

                <ExternalLink className="h-4 w-4 opacity-0 transition duration-200 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
