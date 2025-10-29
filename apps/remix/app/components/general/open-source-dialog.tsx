import { Trans } from '@lingui/react/macro';
import { ExternalLinkIcon } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

export type OpenSourceDialogProps = {
  open: boolean;
  setOpen: (_open: boolean) => void;
};

export const OpenSourceDialog = ({ open, setOpen }: OpenSourceDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Open Source</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Built on open source technology</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-muted-foreground space-y-3 text-sm">
            <p>
              <Trans>
                SuiteOp Sign is built on Documenso, an open source document signing platform.
              </Trans>
            </p>
            <p>
              <Trans>
                We're grateful to the Documenso community for building such a solid foundation and
                making it available to everyone.
              </Trans>
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button asChild variant="outline" className="w-full">
              <a
                href="https://documenso.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <Trans>Visit Documenso</Trans>
                <ExternalLinkIcon className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <a
                href="https://github.com/documenso/documenso"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <Trans>View on GitHub</Trans>
                <ExternalLinkIcon className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
