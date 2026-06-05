import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Trans } from '@lingui/react/macro';
import { createCallable } from 'react-call';

export type SignFieldImageRemoveConfirmationDialogProps = Record<string, never>;

export const SignFieldImageRemoveConfirmationDialog = createCallable<
  SignFieldImageRemoveConfirmationDialogProps,
  boolean
>(({ call }) => {
  return (
    <Dialog open={true} onOpenChange={(value) => (!value ? call.end(false) : null)}>
      <DialogContent position="center" className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Remove Image</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Are you sure you want to remove the uploaded image? You will need to upload it again if you change your
              mind.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => call.end(false)}>
            <Trans>Cancel</Trans>
          </Button>

          <Button type="button" variant="destructive" onClick={() => call.end(true)}>
            <Trans>Remove</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
