'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

<<<<<<< HEAD
import { Recipient } from '@documenso/prisma/client';
import { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
=======
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { type Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
>>>>>>> main
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

<<<<<<< HEAD
=======
import { useRequiredDocumentAuthContext } from './document-auth-provider';
>>>>>>> main
import { useRequiredSigningContext } from './provider';
import { SigningFieldContainer } from './signing-field-container';

export type NameFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
};

export const NameField = ({ field, recipient }: NameFieldProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const { fullName: providedFullName, setFullName: setProvidedFullName } =
    useRequiredSigningContext();

<<<<<<< HEAD
  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation();
=======
  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);
>>>>>>> main

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
<<<<<<< HEAD
  } = trpc.field.removeSignedFieldWithToken.useMutation();
=======
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);
>>>>>>> main

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const [showFullNameModal, setShowFullNameModal] = useState(false);
  const [localFullName, setLocalFullName] = useState('');

<<<<<<< HEAD
  const onSign = async (source: 'local' | 'provider' = 'provider') => {
    try {
      if (!providedFullName && !localFullName) {
=======
  const onPreSign = () => {
    if (!providedFullName) {
      setShowFullNameModal(true);
      return false;
    }

    return true;
  };

  /**
   * When the user clicks the sign button in the dialog where they enter their full name.
   */
  const onDialogSignClick = () => {
    setShowFullNameModal(false);
    setProvidedFullName(localFullName);

    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions, localFullName),
      actionTarget: field.type,
    });
  };

  const onSign = async (authOptions?: TRecipientActionAuth, name?: string) => {
    try {
      const value = name || providedFullName;

      if (!value) {
>>>>>>> main
        setShowFullNameModal(true);
        return;
      }

      await signFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
<<<<<<< HEAD
        value: source === 'local' && localFullName ? localFullName : providedFullName ?? '',
        isBase64: false,
      });

      if (source === 'local' && !providedFullName) {
        setProvidedFullName(localFullName);
      }

      setLocalFullName('');

      startTransition(() => router.refresh());
    } catch (err) {
=======
        value,
        isBase64: false,
        authOptions,
      });

      startTransition(() => router.refresh());
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

>>>>>>> main
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
<<<<<<< HEAD
    <SigningFieldContainer field={field} onSign={onSign} onRemove={onRemove}>
=======
    <SigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      type="Name"
    >
>>>>>>> main
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p className="group-hover:text-primary text-muted-foreground text-lg duration-200">Name</p>
      )}

      {field.inserted && <p className="text-muted-foreground duration-200">{field.customText}</p>}

      <Dialog open={showFullNameModal} onOpenChange={setShowFullNameModal}>
        <DialogContent>
          <DialogTitle>
            Sign as {recipient.name}{' '}
            <span className="text-muted-foreground">({recipient.email})</span>
          </DialogTitle>

<<<<<<< HEAD
          <div className="py-4">
=======
          <div>
>>>>>>> main
            <Label htmlFor="signature">Full Name</Label>

            <Input
              type="text"
              className="mt-2"
              value={localFullName}
<<<<<<< HEAD
              onChange={(e) => setLocalFullName(e.target.value)}
=======
              onChange={(e) => setLocalFullName(e.target.value.trimStart())}
>>>>>>> main
            />
          </div>

          <DialogFooter>
            <div className="flex w-full flex-1 flex-nowrap gap-4">
              <Button
                type="button"
                className="dark:bg-muted dark:hover:bg-muted/80 flex-1  bg-black/5 hover:bg-black/10"
                variant="secondary"
                onClick={() => {
                  setShowFullNameModal(false);
                  setLocalFullName('');
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="flex-1"
                disabled={!localFullName}
<<<<<<< HEAD
                onClick={() => {
                  setShowFullNameModal(false);
                  void onSign('local');
                }}
=======
                onClick={() => onDialogSignClick()}
>>>>>>> main
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
