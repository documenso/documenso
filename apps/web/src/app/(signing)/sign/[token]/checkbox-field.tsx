'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZCheckboxFieldMeta } from '@documenso/lib/types/field-field-meta';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
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
  const [checkedValues, setCheckedValues] = useState<string[]>(
    parsedFieldMeta.values
      ?.map((item, index) =>
        item.checked ? (item.value.length > 0 ? item.value : `empty-${index}`) : '',
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

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value: checkedValues.map((val) => (val.includes('empty') ? ' ' : val)).join(','),
        isBase64: true,
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

  const onRemove = async (fieldType?: string) => {
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

  const handleCheckboxChange = (value: string, index: number) => {
    const updatedValue = value.length > 0 ? value : `empty-${index}`;
    const updatedValues = checkedValues.includes(updatedValue)
      ? checkedValues.filter((v) => v !== updatedValue)
      : [...checkedValues, updatedValue];

    setCheckedValues(updatedValues);
  };

  const handleCheckboxOptionClick = async (
    item: { checked: boolean; value: string },
    index: number,
  ) => {
    let updatedValues: string[] = [];

    try {
      const isChecked = checkedValues.includes(
        item.value.length > 0 ? item.value : `empty-${index}`,
      );

      if (!isChecked) {
        updatedValues = [...checkedValues, item.value.length > 0 ? item.value : `empty-${index}`];

        await removeSignedFieldWithToken({
          token: recipient.token,
          fieldId: field.id,
        });

        if (isLengthConditionMet) {
          await signFieldWithToken({
            token: recipient.token,
            fieldId: field.id,
            value: updatedValues.map((val) => (val.includes('empty') ? ' ' : val)).join(','),
            isBase64: true,
          });
        }
      } else {
        updatedValues = checkedValues.filter((v) => v !== item.value && v !== `empty-${index}`);

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
    if (
      (!field.inserted && checkedValues.length > 0 && isLengthConditionMet) ||
      (!field.inserted && isReadOnly && isLengthConditionMet)
    ) {
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
          <div className="z-50 space-y-4">
            {parsedFieldMeta.values?.map(
              (item: { value: string; checked: boolean }, index: number) => {
                const itemValue = item.value.length > 0 ? item.value : `empty-${index}`;

                return (
                  <Card
                    id={String(index)}
                    key={index}
                    className={cn(
                      'm-1 p-2',
                      {
                        'border-yellow-300 ring-2 ring-yellow-100 ring-offset-2 ring-offset-yellow-100':
                          !field.inserted && !checkedValues.includes(itemValue),
                      },
                      {
                        'border-red-500 ring-2 ring-red-200 ring-offset-2 ring-offset-red-200':
                          !field.inserted &&
                          parsedFieldMeta.required &&
                          !checkedValues.includes(itemValue),
                      },
                      {
                        'border-documenso ring-documenso-200 ring-offset-documenso-200 bg-documenso/20 ring-2 ring-offset-2':
                          checkedValues.includes(itemValue),
                      },
                    )}
                  >
                    <CardContent
                      className={cn(
                        'text-muted-foreground hover:shadow-primary-foreground group flex h-full w-full flex-row items-center space-x-2 p-2',
                        {
                          'hover:text-red-300':
                            !field.inserted &&
                            parsedFieldMeta.required &&
                            !checkedValues.includes(itemValue),
                        },
                        {
                          'hover:text-yellow-400': !field.inserted && !parsedFieldMeta.required,
                        },
                        {
                          'hover:text-foreground/80':
                            !field.inserted && checkedValues.includes(itemValue),
                        },
                      )}
                    >
                      <Checkbox
                        className="data-[state=checked]:bg-documenso h-5 w-5"
                        checkClassName="text-white"
                        id={`checkbox-${index}`}
                        checked={checkedValues.includes(itemValue)}
                        onCheckedChange={() => handleCheckboxChange(item.value, index)}
                      />
                      <Label htmlFor={`checkbox-${index}`}>{item.value}</Label>
                    </CardContent>
                  </Card>
                );
              },
            )}
          </div>
        </>
      )}

      {field.inserted && (
        <div className="flex flex-col gap-y-2">
          {parsedFieldMeta.values?.map(
            (item: { value: string; checked: boolean }, index: number) => {
              const itemValue = item.value.length > 0 ? item.value : `empty-${index}`;

              return (
                <Card
                  key={index}
                  onClick={() => void handleCheckboxOptionClick(item, index)}
                  className={cn(
                    'text-muted-foreground m-1 flex items-center justify-center p-2',
                    {
                      'border-documenso ring-documenso-200 ring-offset-documenso-200 dark:text-foreground/80 ring-2 ring-offset-2':
                        field.inserted,
                    },
                    {
                      'bg-documenso/20 border-documenso ring-documenso-200 ring-offset-documenso-200 dark:text-background/80 ring-2 ring-offset-2':
                        field.inserted && checkedValues.includes(itemValue),
                    },
                  )}
                >
                  <CardContent className="flex h-full w-full flex-row items-center space-x-2 p-2">
                    <Checkbox
                      className="data-[state=checked]:bg-documenso h-5 w-5"
                      checkClassName="text-white"
                      id={`checkbox-${index}`}
                      checked={checkedValues.includes(itemValue)}
                      disabled={isLoading}
                      onCheckedChange={() => handleCheckboxChange(item.value, index)}
                    />
                    <Label htmlFor={`checkbox-${index}`}>{item.value}</Label>
                  </CardContent>
                </Card>
              );
            },
          )}
        </div>
      )}
    </SigningFieldContainer>
  );
};
