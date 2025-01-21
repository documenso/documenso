'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Hash, Loader } from 'lucide-react';

import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { ZNumberFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';
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

import { SigningFieldContainer } from '../signing-field-container';

type ValidationErrors = {
  isNumber: string[];
  required: string[];
  minValue: string[];
  maxValue: string[];
  numberFormat: string[];
};

export type AssistantNumberFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
  selectedSigner: RecipientWithFields | null;
  recipient: RecipientWithFields;
};

export const AssistantNumberField = ({
  field,
  onSignField,
  onUnsignField,
  selectedSigner,
  recipient,
}: AssistantNumberFieldProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const router = useRouter();

  const initialErrors: ValidationErrors = {
    isNumber: [],
    required: [],
    minValue: [],
    maxValue: [],
    numberFormat: [],
  };

  const [errors, setErrors] = useState(initialErrors);
  const [isPending, startTransition] = useTransition();

  const parsedFieldMeta = field.fieldMeta ? ZNumberFieldMeta.parse(field.fieldMeta) : null;

  const [localNumber, setLocalNumber] = useState(
    parsedFieldMeta?.value ? String(parsedFieldMeta.value) : '',
  );
  const [showNumberModal, setShowNumberModal] = useState(false);

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
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
    if (parsedFieldMeta) {
      const validationErrors = validateNumberField(localNumber, parsedFieldMeta, true);

      if (validationErrors.length > 0) {
        setErrors({
          isNumber: validationErrors.filter((error) => error.includes('valid number')),
          required: validationErrors.filter((error) => error.includes('required')),
          minValue: validationErrors.filter((error) => error.includes('minimum value')),
          maxValue: validationErrors.filter((error) => error.includes('maximum value')),
          numberFormat: validationErrors.filter((error) => error.includes('number format')),
        });
        return;
      }
    }

    setShowNumberModal(false);
    void onSign();
  };

  const onPreSign = () => {
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

  const onSign = async () => {
    try {
      if (
        !selectedSigner ||
        !localNumber ||
        Object.values(errors).some((error) => error.length > 0)
      ) {
        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: selectedSigner.token,
        fieldId: field.id,
        value: localNumber,
        isBase64: true,
        assistantId: recipient.id,
        isAssistantPrefill: true,
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
        return;
      }

      await removeSignedFieldWithToken(payload);

      setLocalNumber('');

      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the number.`),
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

  const userInputHasErrors = Object.values(errors).some((error) => error.length > 0);

  let fieldDisplayName = 'Number';

  if (parsedFieldMeta?.label) {
    fieldDisplayName =
      parsedFieldMeta.label.length > 10
        ? parsedFieldMeta.label.substring(0, 10) + '...'
        : parsedFieldMeta.label;
  }

  return (
    <SigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      type="Number"
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
          <span className="flex items-center justify-center gap-x-1">
            <Hash className="h-[clamp(0.625rem,20cqw,0.925rem)] w-[clamp(0.625rem,20cqw,0.925rem)]" />{' '}
            <span className="text-[clamp(0.425rem,25cqw,0.825rem)]">{fieldDisplayName}</span>
          </span>
        </p>
      )}

      {field.inserted && (
        <p className="text-muted-foreground dark:text-background/80 text-[clamp(0.425rem,25cqw,0.825rem)] duration-200">
          {field.customText}
        </p>
      )}

      <Dialog open={showNumberModal} onOpenChange={setShowNumberModal}>
        <DialogContent>
          <DialogTitle>
            {parsedFieldMeta?.label ? parsedFieldMeta?.label : <Trans>Number</Trans>}{' '}
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
                className="dark:bg-muted dark:hover:bg-muted/80 flex-1 bg-black/5 hover:bg-black/10"
                variant="secondary"
                onClick={() => {
                  setShowNumberModal(false);
                  setLocalNumber('');
                }}
              >
                <Trans>Cancel</Trans>
              </Button>

              <Button
                type="button"
                className="flex-1"
                disabled={!localNumber || userInputHasErrors}
                onClick={onDialogSignClick}
              >
                <Trans>Save</Trans>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SigningFieldContainer>
  );
};
