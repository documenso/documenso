import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useRevalidator } from 'react-router';

import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZNumberFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningFieldContainer } from './document-signing-field-container';
import {
  DocumentSigningFieldsInserted,
  DocumentSigningFieldsLoader,
  DocumentSigningFieldsUninserted,
} from './document-signing-fields';
import { useDocumentSigningRecipientContext } from './document-signing-recipient-provider';

type ValidationErrors = {
  isNumber: string[];
  required: string[];
  minValue: string[];
  maxValue: string[];
  numberFormat: string[];
};

export type DocumentSigningNumberFieldProps = {
  field: FieldWithSignature;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DocumentSigningNumberField = ({
  field,
  onSignField,
  onUnsignField,
}: DocumentSigningNumberFieldProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { recipient, isAssistantMode } = useDocumentSigningRecipientContext();

  const [showNumberModal, setShowNumberModal] = useState(false);

  const safeFieldMeta = ZNumberFieldMeta.safeParse(field.fieldMeta);
  const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : null;

  const defaultValue = parsedFieldMeta?.value;
  const [localNumber, setLocalNumber] = useState(() =>
    parsedFieldMeta?.value ? String(parsedFieldMeta.value) : '',
  );

  const initialErrors: ValidationErrors = {
    isNumber: [],
    required: [],
    minValue: [],
    maxValue: [],
    numberFormat: [],
  };

  const [errors, setErrors] = useState(initialErrors);

  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading;

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setLocalNumber(text);

    if (parsedFieldMeta) {
      const validationErrors = validateNumberField(text, parsedFieldMeta, true);
      setErrors({
        isNumber: validationErrors.filter((error) => error.includes('valid number')),
        required: validationErrors.filter((error) => error.includes('required')),
        minValue: validationErrors.filter((error) => error.includes('minimum value')),
        maxValue: validationErrors.filter((error) => error.includes('maximum value')),
        numberFormat: validationErrors.filter((error) => error.includes('number format')),
      });
    } else {
      const validationErrors = validateNumberField(text);
      setErrors((prevErrors) => ({
        ...prevErrors,
        isNumber: validationErrors.filter((error) => error.includes('valid number')),
      }));
    }
  };

  const onDialogSignClick = () => {
    setShowNumberModal(false);

    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
      actionTarget: field.type,
    });
  };

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      if (!localNumber || Object.values(errors).some((error) => error.length > 0)) {
        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value: localNumber,
        isBase64: true,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
        return;
      }

      await signFieldWithToken(payload);

      setLocalNumber('');

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

  const onPreSign = () => {
    if (isAssistantMode) {
      return true;
    }

    setShowNumberModal(true);

    if (localNumber && parsedFieldMeta) {
      const validationErrors = validateNumberField(localNumber, parsedFieldMeta, true);
      setErrors({
        isNumber: validationErrors.filter((error) => error.includes('valid number')),
        required: validationErrors.filter((error) => error.includes('required')),
        minValue: validationErrors.filter((error) => error.includes('minimum value')),
        maxValue: validationErrors.filter((error) => error.includes('maximum value')),
        numberFormat: validationErrors.filter((error) => error.includes('number format')),
      });
    }

    return false;
  };

  const onRemove = async () => {
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

      setLocalNumber(parsedFieldMeta?.value ? String(parsedFieldMeta?.value) : '');

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

  useEffect(() => {
    if (!showNumberModal) {
      setLocalNumber(parsedFieldMeta?.value ? String(parsedFieldMeta.value) : '');
      setErrors(initialErrors);
    }
  }, [showNumberModal]);

  useEffect(() => {
    if (!field.inserted && defaultValue) {
      void executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
        actionTarget: field.type,
      });
    }
  }, []);

  let fieldDisplayName = 'Number';

  if (parsedFieldMeta?.label) {
    fieldDisplayName =
      parsedFieldMeta.label.length > 20
        ? parsedFieldMeta.label.substring(0, 20) + '...'
        : parsedFieldMeta.label;
  }

  const userInputHasErrors = Object.values(errors).some((error) => error.length > 0);

  return (
    <DocumentSigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      type="Number"
    >
      {isLoading && <DocumentSigningFieldsLoader />}

      {!field.inserted && (
        <DocumentSigningFieldsUninserted>{fieldDisplayName}</DocumentSigningFieldsUninserted>
      )}

      {field.inserted && (
        <DocumentSigningFieldsInserted textAlign={parsedFieldMeta?.textAlign}>
          {field.customText}
        </DocumentSigningFieldsInserted>
      )}

      <Dialog open={showNumberModal} onOpenChange={setShowNumberModal}>
        <DialogContent>
          <DialogTitle>
            {parsedFieldMeta?.label ? parsedFieldMeta?.label : <Trans>Number</Trans>}
          </DialogTitle>

          <div>
            <Input
              type="text"
              placeholder={parsedFieldMeta?.placeholder ?? ''}
              className={cn('mt-2 w-full rounded-md', {
                'border-2 border-red-300 ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-200':
                  userInputHasErrors,
              })}
              value={localNumber}
              onChange={handleNumberChange}
            />
          </div>

          {userInputHasErrors && (
            <div>
              {errors.isNumber?.map((error, index) => (
                <p key={index} className="mt-2 text-sm text-red-500">
                  {error}
                </p>
              ))}
              {errors.required?.map((error, index) => (
                <p key={index} className="mt-2 text-sm text-red-500">
                  {error}
                </p>
              ))}
              {errors.minValue?.map((error, index) => (
                <p key={index} className="mt-2 text-sm text-red-500">
                  {error}
                </p>
              ))}
              {errors.maxValue?.map((error, index) => (
                <p key={index} className="mt-2 text-sm text-red-500">
                  {error}
                </p>
              ))}
              {errors.numberFormat?.map((error, index) => (
                <p key={index} className="mt-2 text-sm text-red-500">
                  {error}
                </p>
              ))}
            </div>
          )}

          <DialogFooter>
            <div className="flex w-full flex-1 flex-nowrap gap-4">
              <Button
                type="button"
                className="flex-1"
                variant="secondary"
                onClick={() => {
                  setShowNumberModal(false);
                  setLocalNumber(parsedFieldMeta?.value ? String(parsedFieldMeta.value) : '');
                }}
              >
                <Trans>Cancel</Trans>
              </Button>

              <Button
                type="button"
                className="flex-1"
                disabled={!localNumber || userInputHasErrors}
                onClick={() => onDialogSignClick()}
              >
                <Trans>Save</Trans>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DocumentSigningFieldContainer>
  );
};
