'use client';

import { useEffect, useState, useTransition } from 'react';

import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { Label } from '@documenso/ui/primitives/label';
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
  const [checkedValues, setCheckedValues] = useState<string[]>([]);
  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const { data: document } = trpc.document.getDocumentByToken.useQuery(
    {
      token: String(token),
    },
    {
      enabled: !!token,
    },
  );

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
        value: checkedValues.join(','),
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

  const handleCheckboxChange = (value: string) => {
    const updatedValues = checkedValues.includes(value)
      ? checkedValues.filter((v) => v !== value)
      : [...checkedValues, value];

    setCheckedValues(updatedValues);
  };

  useEffect(() => {
    if (!field.inserted && checkedValues.length > 0) {
      void executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
        actionTarget: field.type,
      });
    }
  }, [checkedValues]);

  return (
    <SigningFieldContainer field={field} onSign={onSign} onRemove={onRemove} type="Checkbox">
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <div className="z-10 space-y-2">
          {field.fieldMeta?.values?.map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Checkbox
                id={`checkbox-${index}`}
                checked={checkedValues.includes(item.value)}
                onCheckedChange={() => handleCheckboxChange(item.value)}
              />
              <Label htmlFor={`checkbox-${index}`}>{item.value}</Label>
            </div>
          ))}
        </div>
      )}

      {field.inserted && (
        <div className="flex flex-wrap justify-center gap-2">
          {field.customText.split(',').map((value, index) => (
            <div key={index} className="rounded-md bg-black px-3 py-1 text-sm text-white">
              {value}
            </div>
          ))}
        </div>
      )}
    </SigningFieldContainer>
  );
};
