'use client';

import { useEffect, useState, useTransition } from 'react';

import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

import { FileTypeIcon, Loader, Type } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@documenso/ui/primitives/dialog';
import type { FieldMeta } from '@documenso/ui/primitives/document-flow/field-item-advanced-settings';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { SigningFieldContainer } from './signing-field-container';

export type TextFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  recipient: Recipient;
};

export const TextField = ({ field, recipient }: TextFieldProps) => {
  const router = useRouter();
  const params = useParams();

  const token = params?.token;
  const { toast } = useToast();

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const { data: document } = trpc.document.getDocumentByToken.useQuery(
    {
      token: String(token),
    },
    {
      enabled: !!token,
    },
  );

  const { data } = trpc.field.getField.useQuery(
    {
      fieldId: field.id,
      documentId: document?.id ?? 0,
    },
    {
      enabled: !!document,
    },
  );

  const fieldMeta = field.fieldMeta as FieldMeta;

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const [showCustomTextModal, setShowCustomTextModal] = useState(false);
  const [localText, setLocalCustomText] = useState('');

  useEffect(() => {
    if (!showCustomTextModal) {
      setLocalCustomText('');
    }
  }, [showCustomTextModal]);

  /**
   * When the user clicks the sign button in the dialog where they enter the text field.
   */
  const onDialogSignClick = () => {
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
        <p className="group-hover:text-primary text-muted-foreground flex flex-col items-center justify-center duration-200">
          <span className="flex items-center justify-center gap-x-1 text-lg">
            <Type /> {fieldMeta.label ?? 'Radio'}
          </span>
        </p>
      )}

      {field.inserted && (
        <p className="text-muted-foreground flex items-center justify-center gap-x-1 duration-200">
          <FileTypeIcon /> {field.customText}
        </p>
      )}

      <Dialog open={showCustomTextModal} onOpenChange={setShowCustomTextModal}>
        <DialogContent>
          <DialogTitle>
            Fill the details <span className="text-muted-foreground">({recipient.email})</span>
          </DialogTitle>

          <div className="">
            <Label htmlFor="custom-text">{fieldMeta.label}</Label>

            <Input
              id="custom-text"
              placeholder={fieldMeta.placeholder ?? 'Enter your text here'}
              className="border-border mt-2 w-full rounded-md border"
              onChange={(e) => setLocalCustomText(e.target.value)}
            />
          </div>

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
                disabled={!localText}
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
