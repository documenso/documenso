import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useRevalidator } from 'react-router';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZRadioFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { Label } from '@documenso/ui/primitives/label';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningFieldContainer } from './document-signing-field-container';
import { DocumentSigningFieldsLoader } from './document-signing-fields';
import { useDocumentSigningRecipientContext } from './document-signing-recipient-provider';

export type DocumentSigningRadioFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DocumentSigningRadioField = ({
  field,
  onSignField,
  onUnsignField,
}: DocumentSigningRadioFieldProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { recipient, targetSigner, isAssistantMode } = useDocumentSigningRecipientContext();

  const parsedFieldMeta = ZRadioFieldMeta.parse(field.fieldMeta);
  const isReadOnly = parsedFieldMeta.readOnly;
  const values = parsedFieldMeta.values?.map((item) => ({
    ...item,
    value: item.value.length > 0 ? item.value : `empty-value-${item.id}`,
  }));
  const checkedItem = values?.find((item) => item.checked);
  const defaultValue = !field.inserted && !!checkedItem ? checkedItem.value : '';

  const [selectedOption, setSelectedOption] = useState(defaultValue);

  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading;
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

      await revalidate();
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the selection.`),
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
    <DocumentSigningFieldContainer field={field} onSign={onSign} onRemove={onRemove} type="Radio">
      {isLoading && <DocumentSigningFieldsLoader />}

      {!field.inserted && (
        <RadioGroup
          onValueChange={(value) => handleSelectItem(value)}
          className="z-10 my-0.5 gap-y-1"
        >
          {values?.map((item, index) => (
            <div key={index} className="flex items-center">
              <RadioGroupItem
                className="h-3 w-3 shrink-0"
                value={item.value}
                id={`option-${field.id}-${item.id}`}
                checked={item.checked}
                disabled={isReadOnly}
              />
              {!item.value.includes('empty-value-') && item.value && (
                <Label
                  htmlFor={`option-${field.id}-${item.id}`}
                  className="text-foreground ml-1.5 text-xs font-normal"
                >
                  {item.value}
                </Label>
              )}
            </div>
          ))}
        </RadioGroup>
      )}

      {field.inserted && (
        <RadioGroup className="my-0.5 gap-y-1">
          {values?.map((item, index) => (
            <div key={index} className="flex items-center">
              <RadioGroupItem
                className="h-3 w-3"
                value={item.value}
                id={`option-${field.id}-${item.id}`}
                checked={item.value === field.customText}
                disabled={isReadOnly}
              />
              {!item.value.includes('empty-value-') && item.value && (
                <Label
                  htmlFor={`option-${field.id}-${item.id}`}
                  className="text-foreground ml-1.5 text-xs font-normal"
                >
                  {item.value}
                </Label>
              )}
            </div>
          ))}
        </RadioGroup>
      )}
    </DocumentSigningFieldContainer>
  );
};
