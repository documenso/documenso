import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { createCallable } from 'react-call';

import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';

import { DocumentSigningDisclosure } from '../general/document-signing/document-signing-disclosure';

export type SignFieldSignatureDialogProps = {
  initialSignature?: string;
  fullName?: string;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
};

export const SignFieldSignatureDialog = createCallable<
  SignFieldSignatureDialogProps,
  string | null
>(
  ({
    call,
    fullName,
    typedSignatureEnabled,
    uploadSignatureEnabled,
    drawSignatureEnabled,
    initialSignature,
  }) => {
    const [localSignature, setLocalSignature] = useState(initialSignature);

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent position="center">
          <div>
            <DialogHeader>
              <DialogTitle>
                <Trans>Sign Signature Field</Trans>
              </DialogTitle>
            </DialogHeader>

            <SignaturePad
              fullName={fullName}
              value={localSignature ?? ''}
              onChange={({ value }) => setLocalSignature(value)}
              typedSignatureEnabled={typedSignatureEnabled}
              uploadSignatureEnabled={uploadSignatureEnabled}
              drawSignatureEnabled={drawSignatureEnabled}
            />
          </div>

          <DocumentSigningDisclosure />

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => call.end(null)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="button"
              disabled={!localSignature}
              onClick={() => call.end(localSignature || null)}
            >
              <Trans>Sign</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);
