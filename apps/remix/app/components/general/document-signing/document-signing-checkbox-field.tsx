import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';
import { useRevalidator } from 'react-router';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZCheckboxFieldMeta } from '@documenso/lib/types/field-meta';
import { fromCheckboxValue, toCheckboxValue } from '@documenso/lib/universal/field-checkbox';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { cn } from '@documenso/ui/lib/utils';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { checkboxValidationSigns } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningFieldContainer } from './document-signing-field-container';
import { useDocumentSigningRecipientContext } from './document-signing-recipient-provider';

export type DocumentSigningCheckboxFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DocumentSigningCheckboxField = ({
  field,
  onSignField,
  onUnsignField,
}: DocumentSigningCheckboxFieldProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { recipient, isAssistantMode } = useDocumentSigningRecipientContext();

  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();

  const parsedFieldMeta = ZCheckboxFieldMeta.parse(
    field.fieldMeta ?? {
      type: 'checkbox',
      values: [{ id: 1, checked: false, value: '' }],
    },
  );

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

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading;
  const shouldAutoSignField =
    (!field.inserted && checkedValues.length > 0 && isLengthConditionMet) ||
    (!field.inserted && isReadOnly && isLengthConditionMet);

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      // Do nothing, this should only happen when the user clicks the field, but
      // misses the checkbox which triggers this callback.
      if (checkedValues.length === 0) {
        return;
      }

      if (!isLengthConditionMet) {
        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value: toCheckboxValue(checkedValues),
        isBase64: true,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
      } else {
        await signFieldWithToken(payload);
      }

      await revalidate();
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      toast({
        title: _(msg`Error`),
        description: isAssistantMode
          ? _(msg`An error occurred while signing as assistant.`)
          : _(msg`An error occurred while signing the document.`),
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

      await revalidate();
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the field.`),
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
      } else {
        updatedValues = checkedValues.filter(
          (v) => v !== item.value && v !== `empty-value-${item.id}`,
        );
      }

      setCheckedValues(updatedValues);

      const removePayload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
      };

      if (onUnsignField) {
        await onUnsignField(removePayload);
      } else {
        await removeSignedFieldWithToken(removePayload);
      }

      if (updatedValues.length > 0 && shouldAutoSignField) {
        const signPayload: TSignFieldWithTokenMutationSchema = {
          token: recipient.token,
          fieldId: field.id,
          value: toCheckboxValue(updatedValues),
          isBase64: true,
        };

        if (onSignField) {
          await onSignField(signPayload);
        } else {
          await signFieldWithToken(signPayload);
        }
      }
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while updating the signature.`),
        variant: 'destructive',
      });
    } finally {
      await revalidate();
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

  const parsedCheckedValues = useMemo(
    () => fromCheckboxValue(field.customText),
    [field.customText],
  );

  return (
    <DocumentSigningFieldContainer
      field={field}
      onSign={onSign}
      onRemove={onRemove}
      type="Checkbox"
    >
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
          <div
            className={cn(
              'z-50 my-0.5 flex gap-1',
              parsedFieldMeta.direction === 'horizontal'
                ? 'flex-row flex-wrap'
                : 'flex-col gap-y-1',
            )}
          >
            {values?.map((item: { id: number; value: string; checked: boolean }, index: number) => {
              const itemValue = item.value || `empty-value-${item.id}`;

              return (
                <div key={index} className="flex items-center">
                  <Checkbox
                    className="h-3 w-3"
                    id={`checkbox-${field.id}-${item.id}`}
                    checked={checkedValues.includes(itemValue)}
                    disabled={isReadOnly}
                    onCheckedChange={() => handleCheckboxChange(item.value, item.id)}
                  />
                  {!item.value.includes('empty-value-') && item.value && (
                    <Label
                      htmlFor={`checkbox-${field.id}-${item.id}`}
                      className="text-foreground ml-1.5 text-xs font-normal"
                    >
                      {item.value}
                    </Label>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {field.inserted && (
        <div
          className={cn(
            'my-0.5 flex gap-1',
            parsedFieldMeta.direction === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col gap-y-1',
          )}
        >
          {values?.map((item: { id: number; value: string; checked: boolean }, index: number) => {
            const itemValue = item.value || `empty-value-${item.id}`;

            return (
              <div key={index} className="flex items-center">
                <Checkbox
                  className="h-3 w-3"
                  id={`checkbox-${field.id}-${item.id}`}
                  checked={parsedCheckedValues.includes(itemValue)}
                  disabled={isLoading || isReadOnly}
                  onCheckedChange={() => void handleCheckboxOptionClick(item)}
                />
                {!item.value.includes('empty-value-') && item.value && (
                  <Label
                    htmlFor={`checkbox-${field.id}-${item.id}`}
                    className="text-foreground ml-1.5 text-xs font-normal"
                  >
                    {item.value}
                  </Label>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DocumentSigningFieldContainer>
  );
};
