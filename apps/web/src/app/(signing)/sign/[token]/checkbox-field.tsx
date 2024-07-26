'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZCheckboxFieldMeta } from '@documenso/lib/types/field-meta';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { checkboxValidationSigns } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { SigningFieldContainer } from './signing-field-container';

export type CheckboxFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  recipient: Recipient;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const CheckboxField = ({
  field,
  recipient,
  onSignField,
  onUnsignField,
}: CheckboxFieldProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const parsedFieldMeta = ZCheckboxFieldMeta.parse(field.fieldMeta);

  const values = parsedFieldMeta.values?.map((item) => ({
    ...item,
    value: item.value.length > 0 ? item.value : `empty-value-${item.id}`,
  }));
  const [checkedValues, setCheckedValues] = useState(
    values
      ?.map((item) =>
        item.checked ? (item.value.length > 0 ? item.value : `empty-value-${item.id}`) : '',
      )
      .filter(Boolean) || [],
  );

  const isReadOnly = parsedFieldMeta.readOnly;

  const checkboxValidationRule = parsedFieldMeta.validationRule;
  const checkboxValidationLength = parsedFieldMeta.validationLength;
  const validationSign = checkboxValidationSigns.find(
    (sign) => sign.label === checkboxValidationRule,
  );

  const isLengthConditionMet = useMemo(() => {
    if (!validationSign) return true;
    return (
      (validationSign.value === '>=' && checkedValues.length >= (checkboxValidationLength || 0)) ||
      (validationSign.value === '=' && checkedValues.length === (checkboxValidationLength || 0)) ||
      (validationSign.value === '<=' && checkedValues.length <= (checkboxValidationLength || 0))
    );
  }, [checkedValues, validationSign, checkboxValidationLength]);

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;
  const shouldAutoSignField =
    (!field.inserted && checkedValues.length > 0 && isLengthConditionMet) ||
    (!field.inserted && isReadOnly && isLengthConditionMet);

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value: checkedValues.join(','),
        isBase64: true,
        authOptions,
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
        title: 'Error',
        description: 'An error occurred while signing the document.',
        variant: 'destructive',
      });
    }
  };

  const onRemove = async (fieldType?: string) => {
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

      if (fieldType === 'Checkbox') {
        setCheckedValues([]);
      }

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

  const handleCheckboxChange = (value: string, itemId: number) => {
    const updatedValue = value || `empty-value-${itemId}`;
    const updatedValues = checkedValues.includes(updatedValue)
      ? checkedValues.filter((v) => v !== updatedValue)
      : [...checkedValues, updatedValue];

    setCheckedValues(updatedValues);
  };

  const handleCheckboxOptionClick = async (item: {
    id: number;
    checked: boolean;
    value: string;
  }) => {
    let updatedValues: string[] = [];

    try {
      const isChecked = checkedValues.includes(
        item.value.length > 0 ? item.value : `empty-value-${item.id}`,
      );

      if (!isChecked) {
        updatedValues = [
          ...checkedValues,
          item.value.length > 0 ? item.value : `empty-value-${item.id}`,
        ];

        await removeSignedFieldWithToken({
          token: recipient.token,
          fieldId: field.id,
        });

        if (isLengthConditionMet) {
          await signFieldWithToken({
            token: recipient.token,
            fieldId: field.id,
            value: updatedValues.join(','),
            isBase64: true,
          });
        }
      } else {
        updatedValues = checkedValues.filter(
          (v) => v !== item.value && v !== `empty-value-${item.id}`,
        );

        await removeSignedFieldWithToken({
          token: recipient.token,
          fieldId: field.id,
        });
      }
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while updating the signature.',
        variant: 'destructive',
      });
    } finally {
      setCheckedValues(updatedValues);
      startTransition(() => router.refresh());
    }
  };

  useEffect(() => {
    if (shouldAutoSignField) {
      void executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
        actionTarget: field.type,
      });
    }
  }, [checkedValues, isLengthConditionMet, field.inserted]);

  return (
    <SigningFieldContainer field={field} onSign={onSign} onRemove={onRemove} type="Checkbox">
      {isLoading && (
        <div className="bg-background absolute inset-0 z-20 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <>
          {!isLengthConditionMet && (
            <FieldToolTip key={field.id} field={field} color="warning" className="">
              {validationSign?.label} {checkboxValidationLength}
            </FieldToolTip>
          )}
          <div className="z-50 flex flex-col gap-y-2">
            {values?.map((item: { id: number; value: string; checked: boolean }, index: number) => {
              const itemValue = item.value || `empty-value-${item.id}`;

              return (
                <div key={index} className="flex items-center gap-x-1.5">
                  <Checkbox
                    className="h-4 w-4"
                    checkClassName="text-white"
                    id={`checkbox-${index}`}
                    checked={checkedValues.includes(itemValue)}
                    onCheckedChange={() => handleCheckboxChange(item.value, item.id)}
                  />
                  <Label htmlFor={`checkbox-${index}`}>
                    {item.value.includes('empty-value-') ? '' : item.value}
                  </Label>
                </div>
              );
            })}
          </div>
        </>
      )}

      {field.inserted && (
        <div className="flex flex-col gap-y-2">
          {values?.map((item: { id: number; value: string; checked: boolean }, index: number) => {
            const itemValue = item.value || `empty-value-${item.id}`;

            return (
              <div key={index} className="flex items-center gap-x-1.5">
                <Checkbox
                  className="h-4 w-4"
                  checkClassName="text-white"
                  id={`checkbox-${index}`}
                  checked={field.customText
                    .split(',')
                    .some((customValue) => customValue === itemValue)}
                  disabled={isLoading}
                  onCheckedChange={() => void handleCheckboxOptionClick(item)}
                />
                <Label htmlFor={`checkbox-${index}`}>
                  {item.value.includes('empty-value-') ? '' : item.value}
                </Label>
              </div>
            );
          })}
        </div>
      )}
    </SigningFieldContainer>
  );
};
