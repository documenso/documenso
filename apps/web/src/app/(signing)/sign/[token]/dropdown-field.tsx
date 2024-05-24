'use client';

import { useEffect, useState, useTransition } from 'react';

import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

import { ChevronDown, Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import type { DropdownFieldMeta } from '@documenso/ui/primitives/document-flow/field-item-advanced-settings';
import type { FieldMeta } from '@documenso/ui/primitives/document-flow/field-item-advanced-settings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { SigningFieldContainer } from './signing-field-container';

export type DropdownFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  recipient: Recipient;
};

export const DropdownField = ({ field, recipient }: DropdownFieldProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const [localText, setLocalCustomText] = useState('');

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const fieldMeta = field.fieldMeta as FieldMeta;

  const isDropdownFieldMeta = (meta: FieldMeta): meta is DropdownFieldMeta => {
    return meta.type === 'dropdown';
  };

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

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

  const handleSelectItem = (val: string) => {
    setLocalCustomText(val);
  };

  useEffect(() => {
    if (!field.inserted && localText) {
      void executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
        actionTarget: field.type,
      });
    }
  }, [localText]);

  return (
    <div className="pointer-events-none">
      <SigningFieldContainer
        field={field}
        onPreSign={onPreSign}
        onSign={onSign}
        onRemove={onRemove}
        type="Dropdown"
      >
        {isLoading && (
          <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
            <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
          </div>
        )}

        {!field.inserted && isDropdownFieldMeta(fieldMeta) && (
          <p className="group-hover:text-primary text-muted-foreground flex flex-col items-center justify-center duration-200">
            <Select value={fieldMeta.defaultValue} onValueChange={handleSelectItem}>
              <SelectTrigger className="text-muted-foreground z-10 h-full w-full border-none ring-0 focus:ring-0">
                <SelectValue placeholder={'-- Select --'} />
              </SelectTrigger>
              <SelectContent className="w-full ring-0 focus:ring-0" position="popper">
                {fieldMeta?.values?.map((item, index) => (
                  <SelectItem key={index} value={item.value} className="ring-0 focus:ring-0">
                    {item.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </p>
        )}

        {field.inserted && (
          <p className="text-muted-foreground flex items-center justify-center gap-x-1 duration-200">
            <span className="flex items-center justify-center gap-x-1 text-xs">
              {field.customText} <ChevronDown />
            </span>
          </p>
        )}
      </SigningFieldContainer>
    </div>
  );
};
