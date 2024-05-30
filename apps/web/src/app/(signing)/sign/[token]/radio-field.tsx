'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZRadioFieldMeta } from '@documenso/lib/types/field-field-meta';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
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
  const [isPending, startTransition] = useTransition();
  const [selectedOption, setSelectedOption] = useState('');

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const parsedFieldMeta = ZRadioFieldMeta.parse(field.fieldMeta);

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      if (!selectedOption) {
        return;
      }

      await signFieldWithToken({
        token: recipient.token,
        fieldId: field.id,
        value: selectedOption,
        isBase64: true,
        authOptions,
      });

      setSelectedOption('');

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

      setSelectedOption('');

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

  const handleSelectItem = (selectedOption: string) => {
    setSelectedOption(selectedOption);
  };

  useEffect(() => {
    if (!field.inserted && selectedOption) {
      void executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
        actionTarget: field.type,
      });
    }
  }, [selectedOption]);

  return (
    <SigningFieldContainer field={field} onSign={onSign} onRemove={onRemove} type="Radio">
      {isLoading && (
        <div className="bg-background absolute inset-0 z-20 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <RadioGroup onValueChange={handleSelectItem} className="z-10">
          {parsedFieldMeta.values?.map((item, index) => (
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
              <CardContent
                className={cn(
                  'text-muted-foreground hover:shadow-primary-foreground group flex h-full w-full flex-row items-center space-x-2 p-2',
                  {
                    'hover:text-red-300': !field.inserted && parsedFieldMeta.required,
                  },
                  {
                    'hover:text-yellow-300': !field.inserted && !parsedFieldMeta.required,
                  },
                )}
              >
                <RadioGroupItem
                  value={item.value}
                  id={`option-${index}`}
                  checked={item.value === field.customText}
                />
                <Label htmlFor={`option-${index}`}>{item.value}</Label>
              </CardContent>
            </Card>
          ))}
        </RadioGroup>
      )}

      {field.inserted && (
        <RadioGroup>
          {parsedFieldMeta.values?.map((item, index) => (
            <Card
              id={String(index)}
              key={index}
              className={cn(
                'm-1 flex items-center justify-center p-2',
                {
                  'border-documenso ring-documenso-200 ring-offset-documenso-200 ring-2 ring-offset-2':
                    field.inserted,
                },
                {
                  'bg-documenso/20 border-documenso':
                    field.inserted && item.value === field.customText,
                },
              )}
            >
              <CardContent className="flex h-full w-full flex-row items-center space-x-2 p-2">
                <RadioGroupItem
                  className="ring-documenso data-[state=checked]:bg-documenso ring-1 ring-offset-2"
                  value={item.value}
                  id={`option-${index}`}
                  checked={item.value === field.customText}
                />
                <Label htmlFor={`option-${index}`}>{item.value}</Label>
              </CardContent>
            </Card>
          ))}
        </RadioGroup>
      )}
    </SigningFieldContainer>
  );
};
