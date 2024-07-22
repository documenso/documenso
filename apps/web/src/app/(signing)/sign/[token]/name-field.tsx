'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

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
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { useRequiredSigningContext } from './provider';
import { SigningFieldContainer } from './signing-field-container';

export type NameFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const NameField = ({ field, recipient, onSignField, onUnsignField }: NameFieldProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const { fullName: providedFullName, setFullName: setProvidedFullName } =
    useRequiredSigningContext();

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const [showFullNameModal, setShowFullNameModal] = useState(false);
  const [localFullName, setLocalFullName] = useState('');

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
        setShowFullNameModal(true);
        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value,
        isBase64: false,
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
        title: 'Error',
        description: 'An error occurred while signing the document.',
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
        title: 'Error',
        description: 'An error occurred while removing the signature.',
        variant: 'destructive',
      });
    }
  };

  return (
    <SigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      type="Name"
    >
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p className="group-hover:text-primary text-muted-foreground duration-200 group-hover:text-yellow-300">
          Name
        </p>
      )}

      {field.inserted && (
        <p className="text-muted-foreground dark:text-background/80 truncate duration-200">
          {field.customText}
        </p>
      )}

      <Dialog open={showFullNameModal} onOpenChange={setShowFullNameModal}>
        <DialogContent>
          <DialogTitle>
            Sign as {recipient.name}{' '}
            <span className="text-muted-foreground">({recipient.email})</span>
          </DialogTitle>

          <div>
            <Label htmlFor="signature">Full Name</Label>

            <Input
              type="text"
              className="mt-2"
              value={localFullName}
              onChange={(e) => setLocalFullName(e.target.value.trimStart())}
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
                onClick={() => onDialogSignClick()}
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
