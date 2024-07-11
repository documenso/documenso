'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Hash, Loader } from 'lucide-react';

import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZNumberFieldMeta } from '@documenso/lib/types/field-meta';
import type { Recipient } from '@documenso/prisma/client';
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

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { SigningFieldContainer } from './signing-field-container';

type ValidationErrors = {
  isNumber: string[];
  required: string[];
  minValue: string[];
  maxValue: string[];
  numberFormat: string[];
};

export type NumberFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const NumberField = ({ field, recipient, onSignField, onUnsignField }: NumberFieldProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showRadioModal, setShowRadioModal] = useState(false);

  const parsedFieldMeta = field.fieldMeta ? ZNumberFieldMeta.parse(field.fieldMeta) : null;
  const isReadOnly = parsedFieldMeta?.readOnly;
  const defaultValue = parsedFieldMeta?.value;
  const [localNumber, setLocalNumber] = useState(
    parsedFieldMeta?.value ? String(parsedFieldMeta.value) : '0',
  );

  const initialErrors: ValidationErrors = {
    isNumber: [],
    required: [],
    minValue: [],
    maxValue: [],
    numberFormat: [],
  };

  const [errors, setErrors] = useState(initialErrors);

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

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
    setShowRadioModal(false);

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

  const onPreSign = () => {
    setShowRadioModal(true);

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

  useEffect(() => {
    if (!showRadioModal) {
      setLocalNumber(parsedFieldMeta?.value ? String(parsedFieldMeta.value) : '0');
      setErrors(initialErrors);
    }
  }, [showRadioModal]);

  useEffect(() => {
    if (
      (!field.inserted && defaultValue && localNumber) ||
      (!field.inserted && isReadOnly && defaultValue)
    ) {
      void executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
        actionTarget: field.type,
      });
    }
  }, []);

  let fieldDisplayName = 'Number';

  if (parsedFieldMeta?.label) {
    fieldDisplayName = parsedFieldMeta.label.length > 10 ? parsedFieldMeta.label.substring(0, 10) + '...' : parsedFieldMeta.label;
  }

  const userInputHasErrors = Object.values(errors).some((error) => error.length > 0);

  return (
    <SigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      type="Signature"
    >
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p
          className={cn(
            'group-hover:text-primary text-muted-foreground flex flex-col items-center justify-center duration-200',
            {
              'group-hover:text-yellow-300': !field.inserted && !parsedFieldMeta?.required,
              'group-hover:text-red-300': !field.inserted && parsedFieldMeta?.required,
            },
          )}
        >
          <span className="flex items-center justify-center gap-x-1 text-sm">
            <Hash className='h-4 w-4' /> {fieldDisplayName}
          </span>
        </p>
      )}

      {field.inserted && (
        <p className="text-muted-foreground dark:text-background/80 flex items-center justify-center gap-x-1 duration-200">
          {field.customText}
        </p>
      )}

      <Dialog open={showRadioModal} onOpenChange={setShowRadioModal}>
        <DialogContent>
          <DialogTitle>
            {parsedFieldMeta?.label ? parsedFieldMeta?.label : 'Add number'}
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
                className="dark:bg-muted dark:hover:bg-muted/80 flex-1  bg-black/5 hover:bg-black/10"
                variant="secondary"
                onClick={() => {
                  setShowRadioModal(false);
                  setLocalNumber('');
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="flex-1"
                disabled={!localNumber || userInputHasErrors}
                onClick={() => onDialogSignClick()}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SigningFieldContainer>
  );
};
