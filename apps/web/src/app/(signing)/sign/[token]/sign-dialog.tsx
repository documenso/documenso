import React, { useEffect, useState } from 'react';

import { Loader } from 'lucide-react';

import { Document, Field } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';

export type SignDialogProps = {
  isSubmitting: boolean;
  showConfirmSignatureDialog: boolean;
  onSignatureComplete: () => void;
  // eslint-disable-next-line no-unused-vars
  setShowConfirmSignatureDialog: (show: boolean) => void;
  document: Document;
  fields: Field[];
};

export default function SignDialog({
  isSubmitting,
  showConfirmSignatureDialog,
  onSignatureComplete,
  setShowConfirmSignatureDialog,
  document,
  fields,
}: SignDialogProps) {
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const isComplete = fields.every((f) => f.inserted);
    setIsComplete(isComplete);
  }, [fields]);

  return (
    <Dialog open={showConfirmSignatureDialog} onOpenChange={setShowConfirmSignatureDialog}>
      <DialogTrigger asChild>
        <Button className="w-full" type="button" size="lg" disabled={!isComplete || isSubmitting}>
          {isSubmitting && <Loader className="mr-2 h-5 w-5 animate-spin" />}
          Complete
        </Button>
      </DialogTrigger>
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
                setShowConfirmSignatureDialog(false);
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              className="flex-1"
              disabled={!isComplete || isSubmitting}
              onClick={onSignatureComplete}
            >
              {isSubmitting && <Loader className="mr-2 h-5 w-5 animate-spin" />}
              Sign
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
