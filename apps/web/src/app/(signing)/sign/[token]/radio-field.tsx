'use client';

import { useState, useTransition } from 'react';

import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';
import { CheckCircle, Disc } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@documenso/ui/primitives/dialog';
import type { FieldMeta } from '@documenso/ui/primitives/document-flow/field-item-advanced-settings';
import { Label } from '@documenso/ui/primitives/label';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { SigningFieldContainer } from './signing-field-container';

export type RadioFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  recipient: Recipient;
};

export const RadioField = ({ field, recipient }: RadioFieldProps) => {
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

  // TODO: Fix this at the end and add the necessary fields for radio field
  const { label: option1, placeholder: option2 } = (data?.fieldMeta as FieldMeta) ?? {};

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
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p className="group-hover:text-primary text-muted-foreground flex flex-col items-center justify-center duration-200">
          <span className="flex items-center justify-center gap-x-1 text-lg">
            <Disc /> Pick an option
          </span>
        </p>
      )}

      {field.inserted && (
        <p className="text-muted-foreground flex items-center justify-center gap-x-1 duration-200">
          <CheckCircle /> {field.customText}
        </p>
      )}

      <Dialog open={showRadioModal} onOpenChange={setShowRadioModal}>
        <DialogContent>
          <DialogTitle>
            Choose an option <span className="text-muted-foreground">({recipient.email})</span>
          </DialogTitle>

          <div>
            <RadioGroup
              onValueChange={(value) => {
                setLocalCustomText(value);
              }}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={option1 ?? 'Option 1'} id="o1" />
                <Label htmlFor="o1">{option1}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={option2 ?? 'Option 2'} id="o2" />
                <Label htmlFor="o2">{option2}</Label>
              </div>
            </RadioGroup>
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

              <Button
                type="button"
                className="flex-1"
                disabled={!localText}
                onClick={() => onDialogSignClick()}
              >
                Sign
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SigningFieldContainer>
  );
};
