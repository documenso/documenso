'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader, Type } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZTextFieldMeta } from '@documenso/lib/types/field-field-meta';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
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
};

export const TextField = ({ field, recipient }: TextFieldProps) => {
  const router = useRouter();
  const { toast } = useToast();

  const initialErrors: Record<string, string[]> = {
    required: [],
    characterLimit: [],
  };

  const [errors, setErrors] = useState(initialErrors);

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const parsedFieldMeta = ZTextFieldMeta.parse(field.fieldMeta);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const [showCustomTextModal, setShowCustomTextModal] = useState(false);
  const [localText, setLocalCustomText] = useState('');

  useEffect(() => {
    if (!showCustomTextModal) {
      setLocalCustomText('');
    }
  }, [showCustomTextModal]);

  const validateText = (text: string) => {
    const errors: Record<string, string[]> = {
      required: [],
      characterLimit: [],
    };

    if (parsedFieldMeta.required && !text) {
      errors.required.push('This field is required.');
    }

    if (parsedFieldMeta.characterLimit && text.length > parsedFieldMeta.characterLimit) {
      errors.characterLimit.push(
        `Text exceeds the character limit of ${parsedFieldMeta.characterLimit}.`,
      );
    }

    return errors;
  };

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setLocalCustomText(text);

    const validationErrors = validateText(text);
    setErrors(validationErrors);
  }, []);

  /**
   * When the user clicks the sign button in the dialog where they enter the text field.
   */
  const onDialogSignClick = () => {
    const validationErrors = validateText(localText);

    if (validationErrors.required.length > 0 || validationErrors.characterLimit.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setShowCustomTextModal(false);

    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
      actionTarget: field.type,
    });
  };

  const onPreSign = () => {
    if (!localText) {
      setShowCustomTextModal(true);
      return false;
    }

    const validationErrors = validateText(localText);

    if (validationErrors.required.length > 0 || validationErrors.characterLimit.length > 0) {
      setErrors(validationErrors);
      return false;
    }

    return true;
  };

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      if (!localText) {
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
        description: 'An error occurred while removing the text.',
        variant: 'destructive',
      });
    }
  };

  const parsedField = ZTextFieldMeta.parse(field.fieldMeta);

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
            <Type />
            {(parsedField?.label?.substring(0, 10) + '...' ||
              parsedField?.text?.substring(0, 10) + '...') ??
              'Add text'}
          </span>
        </p>
      )}

      {field.inserted && (
        <p className="text-muted-foreground flex items-center justify-center gap-x-1 text-xs duration-200">
          {field.customText.length < 10
            ? field.customText
            : field.customText.substring(0, 20) + '...'}
        </p>
      )}

      <Dialog open={showCustomTextModal} onOpenChange={setShowCustomTextModal}>
        <DialogContent>
          <DialogTitle>{parsedFieldMeta.label ?? 'Add Text'}</DialogTitle>

          <div>
            <Textarea
              id="custom-text"
              placeholder={parsedFieldMeta.placeholder ?? 'Enter your text here'}
              className={cn(
                'mt-2 w-full rounded-md',
                {
                  'border-2 border-red-400 ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 focus-visible:border-0 focus-visible:ring-4 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-red-400':
                    errors.required.length > 0 || errors.characterLimit.length > 0,
                },
                {
                  'border-border border':
                    errors.required.length === 0 && errors.characterLimit.length === 0,
                },
              )}
              value={localText}
              onChange={handleTextChange}
            />
          </div>

          {(errors.required.length > 0 || errors.characterLimit.length > 0) && (
            <div>
              {errors.required.map((error, index) => (
                <p key={index} className="text-red-500">
                  {error}
                </p>
              ))}
              {errors.characterLimit.map((error, index) => (
                <p key={index} className="text-red-500">
                  {error}
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
                disabled={
                  !localText || errors.required.length > 0 || errors.characterLimit.length > 0
                }
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
