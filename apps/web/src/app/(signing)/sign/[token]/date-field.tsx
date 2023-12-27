'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  convertToLocalSystemFormat,
} from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SigningFieldContainer } from './signing-field-container';

export type DateFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
  dateFormat?: string | null;
  timezone?: string | null;
};

export const DateField = ({
  field,
  recipient,
  dateFormat = DEFAULT_DOCUMENT_DATE_FORMAT,
  timezone = DEFAULT_DOCUMENT_TIME_ZONE,
}: DateFieldProps) => {
  const router = useRouter();

  const { toast } = useToast();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation();

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation();

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const localDateString = convertToLocalSystemFormat(field.customText, dateFormat, timezone);

  const isDifferentTime = field.inserted && localDateString !== field.customText;

  const tooltipText = `"${field.customText}" will appear on the document as it has a timezone of "${timezone}".`;

  const onSign = async () => {
    try {
      await signFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
        value: dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
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
    <SigningFieldContainer
      field={field}
      onSign={onSign}
      onRemove={onRemove}
      type="Date"
      tooltipText={isDifferentTime ? tooltipText : undefined}
    >
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p className="group-hover:text-primary text-muted-foreground text-lg duration-200">Date</p>
      )}

      {field.inserted && (
        <p className="text-muted-foreground text-sm duration-200">{localDateString}</p>
      )}
    </SigningFieldContainer>
  );
};
