'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZCheckboxFieldMeta } from '@documenso/lib/types/field-field-meta';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
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
  const [isPending, startTransition] = useTransition();
  const [checkedValues, setCheckedValues] = useState<string[]>([]);
  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const parsedFieldMeta = ZCheckboxFieldMeta.parse(field.fieldMeta);

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
        <div className="z-10 space-y-4">
          {parsedFieldMeta.values?.map(
            (item: { value: string; checked: boolean }, index: number) => (
              <Card
                id={String(index)}
                key={index}
                className={cn(
                  'm-1 p-2',
                  {
                    'border-yellow-300 ring-2 ring-yellow-100 ring-offset-2 ring-offset-yellow-100':
                      !field.inserted,
                  },
                  {
                    'border-red-500 ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 hover:text-red-500':
                      !field.inserted && parsedFieldMeta.required,
                  },
                )}
              >
                <CardContent className="text-foreground hover:shadow-primary-foreground group flex h-full w-full flex-row items-center space-x-2 p-2">
                  <Checkbox
                    id={`checkbox-${index}`}
                    checked={checkedValues.includes(item.value)}
                    onCheckedChange={() => handleCheckboxChange(item.value)}
                  />
                  <Label htmlFor={`checkbox-${index}`}>{item.value}</Label>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}

      {field.inserted && (
        <div className="flex flex-col gap-y-2">
          {parsedFieldMeta.values?.map(
            (item: { value: string; checked: boolean }, index: number) => (
              <Card
                key={index}
                className={cn(
                  'm-1 flex items-center justify-center p-2',
                  {
                    'border-documenso ring-documenso-200 ring-offset-documenso-200 ring-2 ring-offset-2':
                      field.inserted,
                  },
                  {
                    'bg-documenso/20 border-documenso ring-documenso-200 ring-offset-documenso-200 ring-2 ring-offset-2':
                      field.inserted && field.customText.split(',').includes(item.value),
                  },
                )}
              >
                <CardContent className="flex h-full w-full flex-row items-center space-x-2 p-2">
                  <Checkbox
                    id={`checkbox-${index}`}
                    checked={field.customText.split(',').includes(item.value)}
                  />
                  <Label htmlFor={`checkbox-${index}`}>{item.value}</Label>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}
    </SigningFieldContainer>
  );
};
