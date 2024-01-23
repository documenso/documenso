'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@documenso/ui/primitives/dialog';
import { Label } from '@documenso/ui/primitives/label';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredSigningContext } from './provider';
import { SigningFieldContainer } from './signing-field-container';

type SignatureFieldState = 'empty' | 'signed-image' | 'signed-text';

export type SignatureFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
};

export const SignatureField = ({ field, recipient }: SignatureFieldProps) => {
  const router = useRouter();

  const { toast } = useToast();
  const { signature: providedSignature, setSignature: setProvidedSignature } =
    useRequiredSigningContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation();

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation();

  const { Signature: signature } = field;

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [localSignature, setLocalSignature] = useState<string | null>(null);
  const [isLocalSignatureSet, setIsLocalSignatureSet] = useState(false);

  const state = useMemo<SignatureFieldState>(() => {
    if (!field.inserted) {
      return 'empty';
    }

    if (signature?.signatureImageAsBase64) {
      return 'signed-image';
    }

    return 'signed-text';
  }, [field.inserted, signature?.signatureImageAsBase64]);

  useEffect(() => {
    if (!showSignatureModal && !isLocalSignatureSet) {
      setLocalSignature(null);
    }
  }, [showSignatureModal, isLocalSignatureSet]);

  const onSign = async (source: 'local' | 'provider' = 'provider') => {
    try {
      if (!providedSignature && !localSignature) {
        setIsLocalSignatureSet(false);
        setShowSignatureModal(true);
        return;
      }

      const value = source === 'local' && localSignature ? localSignature : providedSignature ?? '';

      if (!value) {
        return;
      }

      await signFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
        value,
        isBase64: true,
      });

      if (source === 'local' && !providedSignature) {
        setProvidedSignature(localSignature);
      }

      setLocalSignature(null);

      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while signing the document.',
        variant: 'destructive',
      });
    }
  };

  const onRemove = async () => {
    try {
      await removeSignedFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
      });

      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while removing the signature.',
        variant: 'destructive',
      });
    }
  };

  return (
    <SigningFieldContainer field={field} onSign={onSign} onRemove={onRemove} type="Signature">
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {state === 'empty' && (
        <p className="group-hover:text-primary font-signature text-muted-foreground text-lg duration-200 sm:text-xl md:text-2xl lg:text-3xl">
          Signature
        </p>
      )}

      {state === 'signed-image' && signature?.signatureImageAsBase64 && (
        <img
          src={signature.signatureImageAsBase64}
          alt={`Signature for ${recipient.name}`}
          className="h-full w-full object-contain dark:invert"
        />
      )}

      {state === 'signed-text' && (
        <p className="font-signature text-muted-foreground text-lg duration-200 sm:text-xl md:text-2xl lg:text-3xl">
          {/* This optional chaining is intentional, we don't want to move the check into the condition above */}
          {signature?.typedSignature}
        </p>
      )}

      <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
        <DialogContent>
          <DialogTitle>
            Sign as {recipient.name}{' '}
            <span className="text-muted-foreground">({recipient.email})</span>
          </DialogTitle>

          <div className="">
            <Label htmlFor="signature">Signature</Label>

            <SignaturePad
              id="signature"
              className="border-border mt-2 h-44 w-full rounded-md border"
              onChange={(value) => setLocalSignature(value)}
            />
          </div>

          <DialogFooter>
            <div className="flex w-full flex-1 flex-nowrap gap-4">
              <Button
                type="button"
                className="dark:bg-muted dark:hover:bg-muted/80 flex-1  bg-black/5 hover:bg-black/10"
                variant="secondary"
                onClick={() => {
                  setShowSignatureModal(false);
                  setLocalSignature(null);
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="flex-1"
                disabled={!localSignature}
                onClick={() => {
                  setShowSignatureModal(false);
                  setIsLocalSignatureSet(true);
                  void onSign('local');
                }}
              >
                Sign
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SigningFieldContainer>
  );
};
