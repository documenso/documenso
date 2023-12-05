import { useState } from 'react';

import type { Document, Field } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter } from '@documenso/ui/primitives/dialog';

export type SignDialogProps = {
  isSubmitting: boolean;
  document: Document;
  fields: Field[];
  onSignatureComplete: () => void | Promise<void>;
};

export const SignDialog = ({
  isSubmitting,
  document,
  fields,
  onSignatureComplete,
}: SignDialogProps) => {
  const [showDialog, setShowDialog] = useState(false);

  const isComplete = fields.every((field) => field.inserted);

  const onComplete = () => {
    if (!isComplete) {
      const fieldToScroll = fields.find((field) => !field.inserted);
      if (fieldToScroll) {
        scrollToField(fieldToScroll.id);
      }
    } else {
      setShowDialog(true);
    }
  };

  const scrollToField = (fieldId: number) => {
    const fieldNode = window.document.querySelector(`p[data-field-id='${fieldId}']`);
    if (fieldNode) {
      fieldNode.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <Button
        className="w-full"
        type="button"
        size="lg"
        // disabled={!isComplete}
        loading={isSubmitting}
        onClick={onComplete}
      >
        Complete
      </Button>
      <DialogContent>
        <div className="text-center">
          <div className="text-xl font-semibold text-neutral-800">Sign Document</div>
          <div className="text-muted-foreground mx-auto w-4/5 py-2 text-center">
            You are about to finish signing "{document.title}". Are you sure?
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
