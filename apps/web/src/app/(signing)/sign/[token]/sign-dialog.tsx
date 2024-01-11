import { useState } from 'react';

import type { Document, Field } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';

import { truncateTitle } from '~/helpers/truncate-title';

export type SignDialogProps = {
  isSubmitting: boolean;
  document: Document;
  fields: Field[];
  fieldsValidated: () => void | Promise<void>;
  onSignatureComplete: () => void | Promise<void>;
};

export const SignDialog = ({
  isSubmitting,
  document,
  fields,
  fieldsValidated,
  onSignatureComplete,
}: SignDialogProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const truncatedTitle = truncateTitle(document.title);
  const isComplete = fields.every((field) => field.inserted);

  return (
    <Dialog open={showDialog && isComplete} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button
          className="w-full"
          type="button"
          size="lg"
          onClick={fieldsValidated}
          loading={isSubmitting}
        >
          {isComplete ? 'Complete' : 'Next field'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="text-center">
          <div className="text-xl font-semibold text-neutral-800">Sign Document</div>
          <div className="text-muted-foreground mx-auto w-4/5 py-2 text-center">
            You are about to finish signing "{truncatedTitle}". Are you sure?
          </div>
        </div>

        <DialogFooter>
          <div className="flex w-full flex-1 flex-nowrap gap-4">
            <Button
              type="button"
              className="dark:bg-muted dark:hover:bg-muted/80 flex-1  bg-black/5 hover:bg-black/10"
              variant="secondary"
              onClick={() => {
                setShowDialog(false);
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              className="flex-1"
              disabled={!isComplete}
              loading={isSubmitting}
              onClick={onSignatureComplete}
            >
              Sign
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
