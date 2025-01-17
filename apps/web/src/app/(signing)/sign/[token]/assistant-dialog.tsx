import { useMemo, useState } from 'react';

import { Trans } from '@lingui/macro';

import { fieldsContainUnsignedRequiredField } from '@documenso/lib/utils/advanced-fields-helpers';
import type { Field } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';

export type AssistantDialogProps = {
  documentTitle: string;
  fields: Field[];
  isSubmitting: boolean;
  onSignatureComplete: () => void | Promise<void>;
};

export const AssistantDialog = ({
  documentTitle,
  fields,
  isSubmitting,
  onSignatureComplete,
}: AssistantDialogProps) => {
  const [showDialog, setShowDialog] = useState(false);

  const isComplete = useMemo(() => !fieldsContainUnsignedRequiredField(fields), [fields]);

  const handleOpenChange = (open: boolean) => {
    if (!isComplete) {
      return;
    }

    setShowDialog(open);
  };

  return (
    <Dialog open={showDialog} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <div className="mt-6 flex flex-col gap-4 md:flex-row">
          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            <Trans>Continue</Trans>
          </Button>
        </div>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>
          <div className="text-foreground text-xl font-semibold">Warning</div>
        </DialogTitle>

        <div className="text-muted-foreground max-w-[50ch]">
          <span>
            <Trans>
              <span className="inline-flex flex-wrap">
                You are about to complete viewing "
                <span className="inline-block max-w-[11rem] truncate align-baseline">
                  {documentTitle}
                </span>
                ".
              </span>
              <br /> Are you sure?
            </Trans>
          </span>
        </div>

        <DialogFooter>
          <div className="flex w-full flex-1 flex-nowrap gap-4">
            <Button
              type="button"
              className="dark:bg-muted dark:hover:bg-muted/80 flex-1 bg-black/5 hover:bg-black/10"
              variant="secondary"
              onClick={() => {
                setShowDialog(false);
              }}
            >
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="button"
              className="flex-1"
              disabled={!isComplete || isSubmitting}
              loading={isSubmitting}
              onClick={onSignatureComplete}
            >
              Proceed
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
