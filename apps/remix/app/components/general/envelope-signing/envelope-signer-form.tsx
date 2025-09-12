import { useMemo } from 'react';

import { Trans } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';

import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SignaturePadDialog } from '@documenso/ui/primitives/signature-pad/signature-pad-dialog';

import { useRequiredEnvelopeSigningContext } from '../document-signing/envelope-signing-provider';

export default function EnvelopeSignerForm() {
  const { fullName, signature, setFullName, setSignature, envelope, recipientFields } =
    useRequiredEnvelopeSigningContext();

  const hasSignatureField = useMemo(() => {
    return recipientFields.some((field) => field.type === FieldType.SIGNATURE);
  }, [recipientFields]);

  const isSubmitting = false;

  return (
    <fieldset disabled={isSubmitting} className="flex flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col gap-y-4">
        <div>
          <Label htmlFor="full-name">
            <Trans>Full Name</Trans>
          </Label>

          <Input
            type="text"
            id="full-name"
            className="bg-background mt-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value.trimStart())}
          />
        </div>

        {hasSignatureField && (
          <div>
            <Label htmlFor="Signature">
              <Trans>Signature</Trans>
            </Label>

            <SignaturePadDialog
              className="mt-2"
              disabled={isSubmitting}
              value={signature ?? ''}
              onChange={(v) => setSignature(v ?? '')}
              typedSignatureEnabled={envelope.documentMeta.typedSignatureEnabled}
              uploadSignatureEnabled={envelope.documentMeta.uploadSignatureEnabled}
              drawSignatureEnabled={envelope.documentMeta.drawSignatureEnabled}
            />
          </div>
        )}
      </div>
    </fieldset>
  );
}
