'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

<<<<<<< HEAD
import { Recipient } from '@documenso/prisma/client';
import { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
=======
import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  convertToLocalSystemFormat,
} from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
>>>>>>> main
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SigningFieldContainer } from './signing-field-container';

export type DateFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
<<<<<<< HEAD
};

export const DateField = ({ field, recipient }: DateFieldProps) => {
=======
  dateFormat?: string | null;
  timezone?: string | null;
};

export const DateField = ({
  field,
  recipient,
  dateFormat = DEFAULT_DOCUMENT_DATE_FORMAT,
  timezone = DEFAULT_DOCUMENT_TIME_ZONE,
}: DateFieldProps) => {
>>>>>>> main
  const router = useRouter();

  const { toast } = useToast();

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

  const localDateString = convertToLocalSystemFormat(field.customText, dateFormat, timezone);

  const isDifferentTime = field.inserted && localDateString !== field.customText;

  const tooltipText = `"${field.customText}" will appear on the document as it has a timezone of "${timezone}".`;

  const onSign = async (authOptions?: TRecipientActionAuth) => {
>>>>>>> main
    try {
      await signFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
<<<<<<< HEAD
        value: '',
=======
        value: dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
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
    <SigningFieldContainer
      field={field}
      onSign={onSign}
      onRemove={onRemove}
      type="Date"
      tooltipText={isDifferentTime ? tooltipText : undefined}
    >
>>>>>>> main
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p className="group-hover:text-primary text-muted-foreground text-lg duration-200">Date</p>
      )}

      {field.inserted && (
<<<<<<< HEAD
        <p className="text-muted-foreground text-sm duration-200">{field.customText}</p>
=======
        <p className="text-muted-foreground text-sm duration-200">{localDateString}</p>
>>>>>>> main
      )}
    </SigningFieldContainer>
  );
};
