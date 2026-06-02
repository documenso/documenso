import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@documenso/ui/primitives/dialog';
import { ImageUploadField } from '@documenso/ui/primitives/image-upload-field';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { createCallable } from 'react-call';

export type SignFieldImageUploadDialogProps = {
  initialImage?: string;
};

export const SignFieldImageUploadDialog = createCallable<SignFieldImageUploadDialogProps, string | null>(
  ({ call, initialImage }) => {
    const [localImage, setLocalImage] = useState(initialImage);

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent position="center" className="max-w-lg">
          <div>
            <DialogHeader>
              <DialogTitle>
                <Trans>Upload Image</Trans>
              </DialogTitle>
            </DialogHeader>

            <div className="my-4 rounded-lg border bg-muted/30 p-4">
              <ImageUploadField value={localImage ?? ''} onChange={setLocalImage} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => call.end(null)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button type="button" disabled={!localImage} onClick={() => call.end(localImage || null)}>
              <Trans>Upload</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);
