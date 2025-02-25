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

  const parsedFieldMeta = ZCheckboxFieldMeta.parse(field.fieldMeta);

  const values = parsedFieldMeta.values?.map((item) => ({
    ...item,
    value: item.value.length > 0 ? item.value : `empty-value-${item.id}`,
  }));

  const parsedCheckedValues = useMemo(
    () => fromCheckboxValue(field.customText),
    [field.customText],
  );

  const [checkedValues, setCheckedValues] = useState(
    field.inserted && parsedCheckedValues.length > 0
      ? parsedCheckedValues
      : values
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
      const itemValue = item.value.length > 0 ? item.value : `empty-value-${item.id}`;
      const isChecked = checkedValues.includes(itemValue);

      if (!isChecked) {
        updatedValues = [...checkedValues, itemValue];
      } else {
        updatedValues = checkedValues.filter((v) => v !== itemValue);
      }

      setCheckedValues(updatedValues);

      await removeSignedFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
      });

      if (updatedValues.length > 0) {
        await signFieldWithToken({
          token: recipient.token,
          fieldId: field.id,
          value: toCheckboxValue(updatedValues),
          isBase64: true,
        });
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
    if (field.inserted && parsedCheckedValues.length > 0) {
      setCheckedValues(parsedCheckedValues);
    }
  }, [field.inserted, parsedCheckedValues]);

  useEffect(() => {
    if (shouldAutoSignField) {
      void executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
        actionTarget: field.type,
      });
    }
  }, [checkedValues, isLengthConditionMet, field.inserted]);

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
          <div className="z-50 flex flex-col gap-y-2">
            {values?.map((item: { id: number; value: string; checked: boolean }, index: number) => {
              const itemValue = item.value || `empty-value-${item.id}`;
              const checkboxId = `checkbox-field-${field.id}-${index}`;

              return (
                <div key={index} className="flex items-center gap-x-1.5">
                  <Checkbox
                    className="h-4 w-4"
                    id={checkboxId}
                    checked={checkedValues.includes(itemValue)}
                    onCheckedChange={() => handleCheckboxChange(item.value, item.id)}
                  />
                  <Label htmlFor={checkboxId}>
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
            const checkboxId = `checkbox-field-${field.id}-${index}-inserted`;

            return (
              <div key={index} className="flex items-center gap-x-1.5">
                <Checkbox
                  className="h-4 w-4"
                  id={checkboxId}
                  checked={checkedValues.includes(itemValue)}
                  disabled={isLoading}
                  onCheckedChange={() => void handleCheckboxOptionClick(item)}
                />
                <Label htmlFor={checkboxId}>
                  {item.value.includes('empty-value-') ? '' : item.value}
                </Label>
              </div>
            );
          })}
        </div>
      )}
    </DocumentSigningFieldContainer>
  );
};
