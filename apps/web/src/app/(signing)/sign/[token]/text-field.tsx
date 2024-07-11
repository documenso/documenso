'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader, Type } from 'lucide-react';

import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZTextFieldMeta } from '@documenso/lib/types/field-meta';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@documenso/ui/primitives/dialog';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { SigningFieldContainer } from './signing-field-container';

export type TextFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  recipient: Recipient;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const TextField = ({ field, recipient, onSignField, onUnsignField }: TextFieldProps) => {
  const router = useRouter();
  const { toast } = useToast();

  const initialErrors: Record<string, string[]> = {
    required: [],
    characterLimit: [],
  };

  const [errors, setErrors] = useState(initialErrors);
  const userInputHasErrors = Object.values(errors).some((error) => error.length > 0);

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const parsedFieldMeta = field.fieldMeta ? ZTextFieldMeta.parse(field.fieldMeta) : null;

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;
  const shouldAutoSignField =
    (!field.inserted && parsedFieldMeta?.text) ||
    (!field.inserted && parsedFieldMeta?.text && parsedFieldMeta?.readOnly);

  const [showCustomTextModal, setShowCustomTextModal] = useState(false);
  const [localText, setLocalCustomText] = useState(parsedFieldMeta?.text ?? '');

  useEffect(() => {
    if (!showCustomTextModal) {
      setLocalCustomText(parsedFieldMeta?.text ?? '');
      setErrors(initialErrors);
    }
  }, [showCustomTextModal]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setLocalCustomText(text);

    if (parsedFieldMeta) {
      const validationErrors = validateTextField(text, parsedFieldMeta, true);
      setErrors({
        required: validationErrors.filter((error) => error.includes('required')),
        characterLimit: validationErrors.filter((error) => error.includes('character limit')),
      });
    }
  };

  /**
   * When the user clicks the sign button in the dialog where they enter the text field.
   */
  const onDialogSignClick = () => {
    if (parsedFieldMeta) {
      const validationErrors = validateTextField(localText, parsedFieldMeta, true);

      if (validationErrors.length > 0) {
        setErrors({
          required: validationErrors.filter((error) => error.includes('required')),
          characterLimit: validationErrors.filter((error) => error.includes('character limit')),
        });
        return;
      }
    }

    setShowCustomTextModal(false);

    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
      actionTarget: field.type,
    });
  };

  const onPreSign = () => {
    setShowCustomTextModal(true);

    if (localText && parsedFieldMeta) {
      const validationErrors = validateTextField(localText, parsedFieldMeta, true);
      setErrors({
        required: validationErrors.filter((error) => error.includes('required')),
        characterLimit: validationErrors.filter((error) => error.includes('character limit')),
      });
    }

    return false;
  };

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      if (!localText || userInputHasErrors) {
        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value: localText,
        isBase64: true,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
        return;
      }

      await signFieldWithToken(payload);

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

      setLocalCustomText(parsedFieldMeta?.text ?? '');

      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while removing the text.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (shouldAutoSignField) {
      void executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
        actionTarget: field.type,
      });
    }
  }, []);

  const parsedField = field.fieldMeta ? ZTextFieldMeta.parse(field.fieldMeta) : undefined;

  const labelDisplay =
    parsedField?.label && parsedField.label.length < 20
      ? parsedField.label
      : parsedField?.label
      ? parsedField?.label.substring(0, 20) + '...'
      : undefined;

  const textDisplay =
    parsedField?.text && parsedField.text.length < 20
      ? parsedField.text
      : parsedField?.text
      ? parsedField?.text.substring(0, 20) + '...'
      : undefined;

  const fieldDisplayName = labelDisplay ? labelDisplay : textDisplay ? textDisplay : 'Add text';
  const charactersRemaining = (parsedFieldMeta?.characterLimit ?? 0) - (localText.length ?? 0);

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
          <span className="flex items-center justify-center gap-x-1">
            <Type />
            {fieldDisplayName}
          </span>
        </p>
      )}

      {field.inserted && (
        <p className="text-muted-foreground dark:text-background/80 flex items-center justify-center gap-x-1 duration-200">
          {field.customText.length < 20
            ? field.customText
            : field.customText.substring(0, 15) + '...'}
        </p>
      )}

      <Dialog open={showCustomTextModal} onOpenChange={setShowCustomTextModal}>
        <DialogContent>
          <DialogTitle>{parsedFieldMeta?.label ? parsedFieldMeta?.label : 'Add Text'}</DialogTitle>

          <div>
            <Textarea
              id="custom-text"
              placeholder={parsedFieldMeta?.placeholder ?? 'Enter your text here'}
              className={cn('mt-2 w-full rounded-md', {
                'border-2 border-red-300 ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-200':
                  userInputHasErrors,
              })}
              value={localText}
              onChange={handleTextChange}
            />
          </div>

          {parsedFieldMeta?.characterLimit !== undefined && parsedFieldMeta?.characterLimit > 0 && !userInputHasErrors && (
            <div className="text-muted-foreground text-sm">
              {charactersRemaining} characters remaining
            </div>
          )}

          {userInputHasErrors && (
            <div className="text-sm">
              {errors.required.map((error, index) => (
                <p key={index} className="text-red-500">
                  {error}
                </p>
              ))}
              {errors.characterLimit.map((error, index) => (
                <p key={index} className="text-red-500">
                  {error}{' '}
                  {charactersRemaining < 0 && `(${Math.abs(charactersRemaining)} characters over)`}
                </p>
              ))}
            </div>
          )}

          <DialogFooter>
            <div className="mt-4 flex w-full flex-1 flex-nowrap gap-4">
              <Button
                type="button"
                className="dark:bg-muted dark:hover:bg-muted/80 flex-1  bg-black/5 hover:bg-black/10"
                variant="secondary"
                onClick={() => {
                  setShowCustomTextModal(false);
                  setLocalCustomText('');
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="flex-1"
                disabled={!localText || userInputHasErrors}
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
