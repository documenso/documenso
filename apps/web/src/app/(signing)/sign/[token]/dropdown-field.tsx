'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZDropdownFieldMeta } from '@documenso/lib/types/field-meta';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { cn } from '@documenso/ui/lib/utils';
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
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DropdownField = ({
  field,
  recipient,
  onSignField,
  onUnsignField,
}: DropdownFieldProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const parsedFieldMeta = ZDropdownFieldMeta.parse(field.fieldMeta);
  const isReadOnly = parsedFieldMeta?.readOnly;
  const defaultValue = parsedFieldMeta?.defaultValue;
  const [localChoice, setLocalChoice] = useState(parsedFieldMeta.defaultValue ?? '');

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;
  const shouldAutoSignField =
    (!field.inserted && localChoice) || (!field.inserted && isReadOnly && defaultValue);

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      if (!localChoice) {
        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value: localChoice,
        isBase64: true,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
      } else {
        await signFieldWithToken(payload);
      }

      setLocalChoice('');
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
      const payload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
      };

      if (onUnsignField) {
        await onUnsignField(payload);
        return;
      } else {
        await removeSignedFieldWithToken(payload);
      }

      setLocalChoice(parsedFieldMeta.defaultValue ?? '');
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
    setLocalChoice(val);
  };

  useEffect(() => {
    if (!field.inserted && localChoice) {
      void executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
        actionTarget: field.type,
      });
    }
  }, [localChoice]);

  useEffect(() => {
    if (shouldAutoSignField) {
      void executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions),
        actionTarget: field.type,
      });
    }
  }, []);

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

        {!field.inserted && (
          <p className="group-hover:text-primary text-muted-foreground flex flex-col items-center justify-center duration-200">
            <Select value={parsedFieldMeta.defaultValue} onValueChange={handleSelectItem}>
              <SelectTrigger
                className={cn(
                  'text-muted-foreground z-10 h-full w-full border-none ring-0 focus:ring-0',
                  {
                    'hover:text-red-300': parsedFieldMeta.required,
                    'hover:text-yellow-300': !parsedFieldMeta.required,
                  },
                )}
              >
                <SelectValue placeholder={'-- Select --'} />
              </SelectTrigger>
              <SelectContent className="w-full ring-0 focus:ring-0" position="popper">
                {parsedFieldMeta?.values?.map((item, index) => (
                  <SelectItem key={index} value={item.value} className="ring-0 focus:ring-0">
                    {item.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </p>
        )}

        {field.inserted && (
          <p className="text-muted-foreground dark:text-background/80 flex items-center justify-center gap-x-1 duration-200">
            {field.customText}
          </p>
        )}
      </SigningFieldContainer>
    </div>
  );
};
