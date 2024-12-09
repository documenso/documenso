'use client';

import { useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { type Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@documenso/ui/primitives/dialog';
import { Label } from '@documenso/ui/primitives/label';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SigningDisclosure } from '~/components/general/signing-disclosure';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { useRequiredSigningContext } from './provider';
import { SigningFieldContainer } from './signing-field-container';

type SignatureFieldState = 'empty' | 'signed-image' | 'signed-text';
export type SignatureFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
  typedSignatureEnabled?: boolean;
};

export const SignatureField = ({
  field,
  recipient,
  onSignField,
  onUnsignField,
  typedSignatureEnabled,
}: SignatureFieldProps) => {
  const router = useRouter();

  const { _ } = useLingui();
  const { toast } = useToast();

  const signatureRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(2);

  const {
    signature: providedSignature,
    setSignature: setProvidedSignature,
    signatureValid,
    setSignatureValid,
  } = useRequiredSigningContext();

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const { Signature: signature } = field;

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [localSignature, setLocalSignature] = useState<string | null>(null);

  const state = useMemo<SignatureFieldState>(() => {
    if (!field.inserted) {
      return 'empty';
    }

    if (signature?.signatureImageAsBase64) {
      return 'signed-image';
    }

    return 'signed-text';
  }, [field.inserted, signature?.signatureImageAsBase64]);

  const onPreSign = () => {
    if (!providedSignature || !signatureValid) {
      setShowSignatureModal(true);
      return false;
    }

    return true;
  };
  /**
   * When the user clicks the sign button in the dialog where they enter their signature.
   */
  const onDialogSignClick = () => {
    setShowSignatureModal(false);
    setProvidedSignature(localSignature);
    if (!localSignature) {
      return;
    }

    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions, localSignature),
      actionTarget: field.type,
    });
  };

  const onSign = async (authOptions?: TRecipientActionAuth, signature?: string) => {
    try {
      const value = signature || providedSignature;

      if (!value || (signature && !signatureValid)) {
        setShowSignatureModal(true);
        return;
      }

      const isTypedSignature = !value.startsWith('data:image');

      if (isTypedSignature && !typedSignatureEnabled) {
        toast({
          title: _(msg`Error`),
          description: _(msg`Typed signatures are not allowed. Please draw your signature.`),
          variant: 'destructive',
        });

        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value,
        isBase64: !isTypedSignature,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
        return;
      }

      await signFieldWithToken(payload);

      startTransition(() => router.refresh());
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while signing the document.`),
        variant: 'destructive',
      });
    }
  };

  const onRemove = async () => {
    try {
      const payload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
      };

      if (onUnsignField) {
        await onUnsignField(payload);
        return;
      }

      await removeSignedFieldWithToken(payload);

      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the signature.`),
        variant: 'destructive',
      });
    }
  };

  useLayoutEffect(() => {
    if (!signatureRef.current || !containerRef.current || !signature?.typedSignature) {
      return;
    }

    const adjustTextSize = () => {
      const container = containerRef.current;
      const text = signatureRef.current;

      if (!container || !text) {
        return;
      }

      let size = 2;
      text.style.fontSize = `${size}rem`;

      while (
        (text.scrollWidth > container.clientWidth || text.scrollHeight > container.clientHeight) &&
        size > 0.8
      ) {
        size -= 0.1;
        text.style.fontSize = `${size}rem`;
      }

      setFontSize(size);
    };

    const resizeObserver = new ResizeObserver(adjustTextSize);
    resizeObserver.observe(containerRef.current);

    adjustTextSize();

    return () => resizeObserver.disconnect();
  }, [signature?.typedSignature]);

  return (
    <SigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      type="Signature"
    >
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {state === 'empty' && (
        <p className="group-hover:text-primary font-signature text-muted-foreground text-[clamp(0.575rem,25cqw,1.2rem)] text-xl duration-200 group-hover:text-yellow-300">
          <Trans>Signature</Trans>
        </p>
      )}

      {state === 'signed-image' && signature?.signatureImageAsBase64 && (
        <img
          src={signature.signatureImageAsBase64}
          alt={`Signature for ${recipient.name}`}
          className="h-full w-full object-contain"
        />
      )}

      {state === 'signed-text' && (
        <div ref={containerRef} className="flex h-full w-full items-center justify-center p-2">
          <p
            ref={signatureRef}
            className="font-signature text-muted-foreground dark:text-background w-full overflow-hidden break-all text-center leading-tight duration-200"
            style={{ fontSize: `${fontSize}rem` }}
          >
            {signature?.typedSignature}
          </p>
        </div>
      )}

      <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
        <DialogContent>
          <DialogTitle>
            <Trans>
              Sign as {recipient.name}{' '}
              <div className="text-muted-foreground h-5">({recipient.email})</div>
            </Trans>
          </DialogTitle>

          <div className="">
            <Label htmlFor="signature">
              <Trans>Signature</Trans>
            </Label>

            <div className="border-border mt-2 rounded-md border">
              <SignaturePad
                id="signature"
                className="h-44 w-full"
                onChange={(value) => setLocalSignature(value)}
                allowTypedSignature={typedSignatureEnabled}
                onValidityChange={(isValid) => {
                  setSignatureValid(isValid);
                }}
              />
            </div>

            {!signatureValid && (
              <div className="text-destructive mt-2 text-sm">
                <Trans>Signature is too small. Please provide a more complete signature.</Trans>
              </div>
            )}
          </div>

          <SigningDisclosure />
          <DialogFooter>
            <div className="flex w-full flex-1 flex-nowrap gap-4">
              <Button
                type="button"
                className="dark:bg-muted dark:hover:bg-muted/80 flex-1 bg-black/5 hover:bg-black/10"
                variant="secondary"
                onClick={() => {
                  setShowSignatureModal(false);
                  setLocalSignature(null);
                }}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!localSignature || !signatureValid}
                onClick={() => onDialogSignClick()}
              >
                <Trans>Sign</Trans>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SigningFieldContainer>
  );
};
