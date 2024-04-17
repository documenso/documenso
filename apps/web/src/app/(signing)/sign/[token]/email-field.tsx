'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

<<<<<<< HEAD
import { Recipient } from '@documenso/prisma/client';
import { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
=======
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
>>>>>>> main
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredSigningContext } from './provider';
import { SigningFieldContainer } from './signing-field-container';

export type EmailFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
};

export const EmailField = ({ field, recipient }: EmailFieldProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const { email: providedEmail } = useRequiredSigningContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
<<<<<<< HEAD
    trpc.field.signFieldWithToken.useMutation();
=======
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);
>>>>>>> main

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
<<<<<<< HEAD
  } = trpc.field.removeSignedFieldWithToken.useMutation();

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const onSign = async () => {
=======
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const onSign = async (authOptions?: TRecipientActionAuth) => {
>>>>>>> main
    try {
      await signFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
        value: providedEmail ?? '',
        isBase64: false,
<<<<<<< HEAD
=======
        authOptions,
>>>>>>> main
      });

      startTransition(() => router.refresh());
    } catch (err) {
<<<<<<< HEAD
=======
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
    <SigningFieldContainer field={field} onSign={onSign} onRemove={onRemove} type="Email">
>>>>>>> main
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p className="group-hover:text-primary text-muted-foreground text-lg duration-200">Email</p>
      )}

      {field.inserted && <p className="text-muted-foreground duration-200">{field.customText}</p>}
    </SigningFieldContainer>
  );
};
