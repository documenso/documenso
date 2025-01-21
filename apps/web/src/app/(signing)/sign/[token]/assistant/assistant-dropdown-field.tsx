'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { ZDropdownFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';
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

import { SigningFieldContainer } from '../signing-field-container';

export type AssistantDropdownFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
  selectedSigner: RecipientWithFields | null;
  recipient: RecipientWithFields;
};

export const AssistantDropdownField = ({
  field,
  onSignField,
  onUnsignField,
  selectedSigner,
  recipient,
}: AssistantDropdownFieldProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const parsedFieldMeta = ZDropdownFieldMeta.parse(field.fieldMeta);
  const isReadOnly = parsedFieldMeta.readOnly;
  const defaultValue = parsedFieldMeta.defaultValue;
  const [localChoice, setLocalChoice] = useState(parsedFieldMeta.defaultValue ?? '');

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;
  const shouldAutoSignField =
    (!field.inserted && localChoice) || (!field.inserted && isReadOnly && defaultValue);

  const onSign = async () => {
    try {
      if (!selectedSigner || !localChoice) {
        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: selectedSigner.token,
        fieldId: field.id,
        value: localChoice,
        isBase64: true,
        isAssistantPrefill: true,
        assistantId: recipient.id,
      };

      if (onSignField) {
        await onSignField(payload);
      } else {
        await signFieldWithToken(payload);
      }

      startTransition(() => router.refresh());
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while signing as assistant.`),
        variant: 'destructive',
      });
    }
  };

  const onPreSign = () => {
    return true;
  };

  const onRemove = async () => {
    try {
      if (!selectedSigner) {
        return;
      }

      const payload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: selectedSigner.token,
        fieldId: field.id,
      };

      if (onUnsignField) {
        await onUnsignField(payload);
      } else {
        await removeSignedFieldWithToken(payload);
      }

      setLocalChoice('');
      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the selection.`),
        variant: 'destructive',
      });
    }
  };

  const handleSelectItem = (val: string) => {
    setLocalChoice(val);
  };

  useEffect(() => {
    if (!field.inserted && localChoice) {
      void onSign();
    }
  }, [localChoice]);

  useEffect(() => {
    if (shouldAutoSignField) {
      void onSign();
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
            <Select value={localChoice} onValueChange={handleSelectItem}>
              <SelectTrigger
                className={cn(
                  'text-muted-foreground z-10 h-full w-full border-none ring-0 focus:ring-0',
                  {
                    'hover:text-red-300': parsedFieldMeta.required,
                    'hover:text-yellow-300': !parsedFieldMeta.required,
                  },
                )}
              >
                <SelectValue
                  className="text-[clamp(0.425rem,25cqw,0.825rem)]"
                  placeholder={`${_(msg`Select`)}`}
                />
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
          <p className="text-muted-foreground dark:text-background/80 text-[clamp(0.425rem,25cqw,0.825rem)] duration-200">
            {field.customText}
          </p>
        )}
      </SigningFieldContainer>
    </div>
  );
};
