'use client';

import { useState, useTransition } from 'react';

import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';
import { CheckSquare } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import type { FieldMeta } from '@documenso/ui/primitives/document-flow/field-item-advanced-settings';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { SigningFieldContainer } from './signing-field-container';

export type CheckboxFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  recipient: Recipient;
};

export const CheckboxField = ({ field, recipient }: CheckboxFieldProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const token = params?.token;
  const [checkboxValue, setCheckboxValue] = useState('');

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

  const { label } = (data?.fieldMeta as FieldMeta) ?? {};

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      await signFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
        value: label ?? checkboxValue,
        isBase64: true,
        authOptions,
      });

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

  const handleCheckboxClick = () => {
    setCheckboxValue(checkboxValue === 'checked' ? '' : 'checked');

    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
      actionTarget: field.type,
    });
  };

  return (
    <div className="pointer-events-none">
      <SigningFieldContainer
        field={field}
        onPreSign={onPreSign}
        onSign={onSign}
        onRemove={onRemove}
        type="Checkbox"
      >
        {isLoading && (
          <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
            <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
          </div>
        )}

        {!field.inserted && (
          <p className="group-hover:text-primary text-muted-foreground flex flex-col items-center justify-center duration-200">
            <span className="flex items-center justify-center gap-x-1 text-lg">
              <div className="flex items-center gap-2.5 py-1">
                <Checkbox
                  className="h-5 w-5 data-[state=checked]:border-black data-[state=checked]:bg-black"
                  checkClassName="text-white"
                  checked={checkboxValue === 'checked'}
                  onClick={handleCheckboxClick}
                />
                {label}
              </div>
            </span>
          </p>
        )}

        {field.inserted && (
          <p className="text-muted-foreground flex items-center justify-center gap-x-1 duration-200">
            <CheckSquare /> {field.fieldMeta?.label ?? 'Checkbox'}
          </p>
        )}
      </SigningFieldContainer>
    </div>
  );
};
