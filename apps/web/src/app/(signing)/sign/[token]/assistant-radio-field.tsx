'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { ZRadioFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { Label } from '@documenso/ui/primitives/label';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SigningFieldContainer } from './signing-field-container';

export type AssistantRadioFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
  selectedSigner: RecipientWithFields | null;
  recipient: RecipientWithFields;
};

export const AssistantRadioField = ({
  field,
  onSignField,
  onUnsignField,
  selectedSigner,
  recipient,
}: AssistantRadioFieldProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const parsedFieldMeta = ZRadioFieldMeta.parse(field.fieldMeta);
  const values = parsedFieldMeta.values?.map((item) => ({
    ...item,
    value: item.value.length > 0 ? item.value : `empty-value-${item.id}`,
  }));
  const checkedItem = values?.find((item) => item.checked);
  const defaultValue = !field.inserted && !!checkedItem ? checkedItem.value : '';

  const [selectedOption, setSelectedOption] = useState(defaultValue);

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;
  const shouldAutoSignField =
    (!field.inserted && selectedOption) || (!field.inserted && defaultValue);

  const onSign = async () => {
    try {
      if (!selectedSigner || !selectedOption) {
        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: selectedSigner.token,
        fieldId: field.id,
        value: selectedOption,
        isBase64: true,
        isAssistantPrefill: true,
        assistantId: recipient.id,
      };

      if (onSignField) {
        await onSignField(payload);
      } else {
        await signFieldWithToken(payload);
      }

      startTransition(() => router.refresh());
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while signing as assistant.`),
        variant: 'destructive',
      });
    }
  };

  const onRemove = async () => {
    try {
      if (!selectedSigner) {
        return;
      }

      const payload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: selectedSigner.token,
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
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the selection.`),
        variant: 'destructive',
      });
    }
  };

  const handleSelectItem = (selectedValue: string) => {
    setSelectedOption(selectedValue);
  };

  useEffect(() => {
    if (shouldAutoSignField) {
      void onSign();
    }
  }, [selectedOption]);

  return (
    <SigningFieldContainer field={field} onSign={onSign} onRemove={onRemove} type="Radio">
      {isLoading && (
        <div className="bg-background absolute inset-0 z-20 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <RadioGroup value={selectedOption} onValueChange={handleSelectItem} className="z-10">
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
        <RadioGroup className="gap-y-1">
          {values?.map((item, index) => (
            <div key={index} className="flex items-center gap-x-1.5">
              <RadioGroupItem
                className="h-3 w-3"
                value={item.value}
                id={`option-${index}`}
                checked={item.value === field.customText}
              />
              <Label htmlFor={`option-${index}`} className="text-xs">
                {item.value.includes('empty-value-') ? '' : item.value}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}
    </SigningFieldContainer>
  );
};
