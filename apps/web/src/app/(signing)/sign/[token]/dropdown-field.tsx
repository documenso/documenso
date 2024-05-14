'use client';

import { useState, useTransition } from 'react';

import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

import { ChevronDown } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@documenso/ui/primitives/dialog';
import type { FieldMeta } from '@documenso/ui/primitives/document-flow/field-item-advanced-settings';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { SigningFieldContainer } from './signing-field-container';

export type DropdownFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
};

export const DropdownField = ({ field, recipient }: DropdownFieldProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const [showRadioModal, setShowRadioModal] = useState(false);
  const [localText, setLocalCustomText] = useState('');
  const token = params?.token;

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

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

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const onDialogSignClick = () => {
    setShowRadioModal(false);

    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
      actionTarget: field.type,
    });
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

  return (
    <SigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      type="Radio"
    >
      {!field.inserted && (
        <p className="group-hover:text-primary text-muted-foreground flex flex-col items-center justify-center duration-200">
          <span className="flex items-center justify-center gap-x-1 text-lg">
            <ChevronDown /> {fieldMeta.label ?? 'Radio'}
          </span>
          <p className="mt-1 text-xs">{fieldMeta.placeholder}</p>
        </p>
      )}

      {field.inserted && (
        <p className="text-muted-foreground flex items-center justify-center gap-x-1 duration-200">
          <ChevronDown /> {field.customText}
        </p>
      )}

      <Dialog open={showRadioModal} onOpenChange={setShowRadioModal}>
        <DialogContent>
          <DialogTitle>
            Select an option <span className="text-muted-foreground">({recipient.email})</span>
          </DialogTitle>

          <div>
            <Label htmlFor="signature">Select</Label>

            {/* TODO: Update to dropdown */}
            <Input
              type="text"
              className="mt-2"
              onChange={(e) => setLocalCustomText(e.target.value)}
            />
          </div>

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

              <Button type="button" className="flex-1" onClick={() => onDialogSignClick()}>
                Sign
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SigningFieldContainer>
  );
};
