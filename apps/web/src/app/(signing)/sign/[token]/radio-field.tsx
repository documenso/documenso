'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZRadioFieldMeta } from '@documenso/lib/types/field-meta';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { Label } from '@documenso/ui/primitives/label';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { SigningFieldContainer } from './signing-field-container';

export type RadioFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  recipient: Recipient;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const RadioField = ({ field, recipient, onSignField, onUnsignField }: RadioFieldProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const parsedFieldMeta = ZRadioFieldMeta.parse(field.fieldMeta);
  const values = parsedFieldMeta.values?.map((item) => ({
    ...item,
    value: item.value.length > 0 ? item.value : `empty-value-${item.id}`,
  }));
  const checkedItem = values?.find((item) => item.checked);
  const defaultValue = !field.inserted && !!checkedItem ? checkedItem.value : '';

  const [selectedOption, setSelectedOption] = useState(defaultValue);

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;
  const shouldAutoSignField =
    (!field.inserted && selectedOption) ||
    (!field.inserted && defaultValue) ||
    (!field.inserted && parsedFieldMeta.readOnly && defaultValue);

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      if (!selectedOption) {
        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value: selectedOption,
        isBase64: true,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
      } else {
        await signFieldWithToken(payload);
      }

      setSelectedOption('');
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
      } else {
        await removeSignedFieldWithToken(payload);
      }

      setSelectedOption('');

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

  const handleSelectItem = (selectedOption: string) => {
    setSelectedOption(selectedOption);
  };

  useEffect(() => {
    if (shouldAutoSignField) {
      void executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
        actionTarget: field.type,
      });
    }
  }, [selectedOption, field]);

  return (
    <SigningFieldContainer field={field} onSign={onSign} onRemove={onRemove} type="Radio">
      {isLoading && (
        <div className="bg-background absolute inset-0 z-20 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <RadioGroup onValueChange={(value) => handleSelectItem(value)} className="z-10">
          {values?.map((item, index) => (
            <div key={index} className="flex items-center gap-x-1.5">
              <RadioGroupItem
                className="h-4 w-4 shrink-0"
                value={item.value}
                id={`option-${index}`}
                checked={item.checked}
              />

              <Label htmlFor={`option-${index}`}>
                {item.value.includes('empty-value-') ? '' : item.value}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {field.inserted && (
        <RadioGroup>
          {values?.map((item, index) => (
            <div key={index} className="flex items-center gap-x-1.5">
                <RadioGroupItem
                  className=""
                  value={item.value}
                  id={`option-${index}`}
                  checked={item.value === field.customText}
                />
                <Label htmlFor={`option-${index}`}>
                  {item.value.includes('empty-value-') ? '' : item.value}
                </Label>
            </div>
          ))}
        </RadioGroup>
      )}
    </SigningFieldContainer>
  );
};
