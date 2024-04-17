'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import { Recipient } from '@documenso/prisma/client';
import { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
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
    trpc.field.signFieldWithToken.useMutation();

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation();

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const onSign = async () => {
    try {
      await signFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
        value: providedEmail ?? '',
        isBase64: false,
      });

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
    <SigningFieldContainer field={field} onSign={onSign} onRemove={onRemove}>
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
