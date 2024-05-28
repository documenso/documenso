'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';
import { Hash } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZNumberFieldMeta } from '@documenso/lib/types/field-field-meta';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { SigningFieldContainer } from './signing-field-container';

export type NumberFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
};

export const NumberField = ({ field, recipient }: NumberFieldProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showRadioModal, setShowRadioModal] = useState(false);
  const [localText, setLocalCustomText] = useState('');

  const initialErrors: Record<string, string[]> = {
    isNumber: [],
    required: [],
    minValue: [],
    maxValue: [],
    numberFormat: [],
  };

  const [errors, setErrors] = useState(initialErrors);

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const parsedFieldMeta = ZNumberFieldMeta.parse(field.fieldMeta);

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const validateNumber = (text: string) => {
    const errors: Record<string, string[]> = {
      isNumber: [],
      required: [],
      minValue: [],
      maxValue: [],
      numberFormat: [],
    };

    const numericRegex = /^[\d,.]+$/;
    const isNumeric = numericRegex.test(text);

    if (parsedFieldMeta.required && !text) {
      errors.required.push('This field is required.');
    }

    if (!isNumeric && text.length > 0) {
      errors.isNumber.push(`Value ${text} is not a number`);
    }

    if (parsedFieldMeta.minValue && Number(text) < parsedFieldMeta.minValue) {
      errors.minValue.push(`Value must be greater than or equal to ${parsedFieldMeta.minValue}.`);
    }

    if (parsedFieldMeta.maxValue && Number(text) > parsedFieldMeta.maxValue) {
      errors.maxValue.push(`Value must be less than or equal to ${parsedFieldMeta.maxValue}.`);
    }

    if (parsedFieldMeta.numberFormat) {
      const formatRegex =
        parsedFieldMeta.numberFormat === '123.456,78'
          ? new RegExp(/^(\d+(?:\.\d+)?(?:,\d+)?)$/)
          : parsedFieldMeta.numberFormat === '123,456.78'
          ? new RegExp(/^(\d+(?:,\d+)?(?:\.\d+)?)$/)
          : new RegExp(/.*/);

      if (!formatRegex.test(text)) {
        errors.numberFormat.push(
          `Value ${text} does not match the number format - ${parsedFieldMeta.numberFormat}`,
        );
      }
    }

    return errors;
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setLocalCustomText(text);

    const validationErrors = validateNumber(text);
    setErrors(validationErrors);
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
      if (!localText || Object.values(errors).some((error) => error.length > 0)) {
        return;
      }

      await signFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
        value: localText,
        isBase64: true,
        authOptions,
      });

      setLocalCustomText('');

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
    if (!localText) {
      setShowRadioModal(true);
      return false;
    }

    return true;
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

  useEffect(() => {
    if (!showRadioModal) {
      setLocalCustomText('');
      setErrors(initialErrors);
    }
  }, [showRadioModal]);

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
              'group-hover:text-yellow-300': !field.inserted && !parsedFieldMeta.required,
              'group-hover:text-red-300': !field.inserted && parsedFieldMeta.required,
            },
          )}
        >
          <span className="flex items-center justify-center gap-x-1">
            <Hash /> {parsedFieldMeta?.label?.substring(0, 10) + '...' || 'Number'}
          </span>
        </p>
      )}

      {field.inserted && (
        <p className="text-muted-foreground flex items-center justify-center gap-x-1 text-xs duration-200">
          {field.customText}
        </p>
      )}

      <Dialog open={showRadioModal} onOpenChange={setShowRadioModal}>
        <DialogContent>
          <DialogTitle>Add number</DialogTitle>

          <div>
            <Input
              type="text"
              placeholder={parsedFieldMeta.placeholder}
              className={cn(
                'mt-2 w-full rounded-md',
                {
                  'border-2 border-red-400 ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 focus-visible:ring-4 focus-visible:ring-red-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-200':
                    Object.values(errors).some((error) => error.length > 0),
                },
                {
                  'border-border border': Object.values(errors).every(
                    (error) => error.length === 0,
                  ),
                },
              )}
              value={localText}
              onChange={handleNumberChange}
            />
          </div>

          {Object.values(errors).some((error) => error.length > 0) && (
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
                  setLocalCustomText('');
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="flex-1"
                disabled={!localText || Object.values(errors).some((error) => error.length > 0)}
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
