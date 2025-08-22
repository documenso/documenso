import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { useRevalidator } from 'react-router';

import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZTextFieldMeta } from '@documenso/lib/types/field-meta';
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

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningFieldContainer } from './document-signing-field-container';
import {
  DocumentSigningFieldsInserted,
  DocumentSigningFieldsLoader,
  DocumentSigningFieldsUninserted,
} from './document-signing-fields';
import { useDocumentSigningRecipientContext } from './document-signing-recipient-provider';

export type DocumentSigningTextFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

type ValidationErrors = {
  required: string[];
  characterLimit: string[];
};

export type TextFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DocumentSigningTextField = ({
  field,
  onSignField,
  onUnsignField,
}: DocumentSigningTextFieldProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { recipient, isAssistantMode } = useDocumentSigningRecipientContext();

  const initialErrors: ValidationErrors = {
    required: [],
    characterLimit: [],
  };
  const [errors, setErrors] = useState(initialErrors);
  const userInputHasErrors = Object.values(errors).some((error) => error.length > 0);

  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const safeFieldMeta = ZTextFieldMeta.safeParse(field.fieldMeta);
  const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : null;

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading;
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
        return;
      }

      await removeSignedFieldWithToken(payload);

      setLocalCustomText(parsedFieldMeta?.text ?? '');

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
    if (shouldAutoSignField) {
      void executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
        actionTarget: field.type,
      });
    }
  }, []);

  const parsedField = field.fieldMeta ? ZTextFieldMeta.parse(field.fieldMeta) : undefined;

  const labelDisplay = parsedField?.label;
  const textDisplay = parsedField?.text;

  const fieldDisplayName = labelDisplay ? labelDisplay : textDisplay;
  const charactersRemaining = (parsedFieldMeta?.characterLimit ?? 0) - (localText.length ?? 0);

  return (
    <DocumentSigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      type="Text"
    >
      {isLoading && <DocumentSigningFieldsLoader />}

      {!field.inserted && (
        <DocumentSigningFieldsUninserted>
          {fieldDisplayName || <Trans>Text</Trans>}
        </DocumentSigningFieldsUninserted>
      )}

      {field.inserted && (
        <DocumentSigningFieldsInserted textAlign={parsedFieldMeta?.textAlign}>
          {field.customText}
        </DocumentSigningFieldsInserted>
      )}

      <Dialog open={showCustomTextModal} onOpenChange={setShowCustomTextModal}>
        <DialogContent>
          <DialogTitle>
            {parsedFieldMeta?.label ? parsedFieldMeta?.label : <Trans>Text</Trans>}
          </DialogTitle>

          <div>
            <Textarea
              id="custom-text"
              placeholder={parsedFieldMeta?.placeholder ?? _(msg`Enter your text here`)}
              className={cn('mt-2 w-full rounded-md', {
                'border-2 border-red-300 text-left ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-200':
                  userInputHasErrors,
                'text-center': parsedFieldMeta?.textAlign === 'center',
                'text-right': parsedFieldMeta?.textAlign === 'right',
              })}
              value={localText}
              onChange={handleTextChange}
            />
          </div>

          {parsedFieldMeta?.characterLimit !== undefined &&
            parsedFieldMeta?.characterLimit > 0 &&
            !userInputHasErrors && (
              <div className="text-muted-foreground text-sm">
                <Plural
                  value={charactersRemaining}
                  one="1 character remaining"
                  other={`${charactersRemaining} characters remaining`}
                />
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
                  {charactersRemaining < 0 && (
                    <Plural
                      value={Math.abs(charactersRemaining)}
                      one="(1 character over)"
                      other="(# characters over)"
                    />
                  )}
                </p>
              ))}
            </div>
          )}

          <DialogFooter>
            <div className="mt-4 flex w-full flex-1 flex-nowrap gap-4">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowCustomTextModal(false);
                  setLocalCustomText('');
                }}
              >
                <Trans>Cancel</Trans>
              </Button>

              <Button
                type="button"
                className="flex-1"
                disabled={!localText || userInputHasErrors}
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
