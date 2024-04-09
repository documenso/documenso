'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { Form, FormControl, FormField } from '@documenso/ui/primitives/form/form';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SigningFieldContainer } from './signing-field-container';

export type CheckboxFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
};

const CheckBoxSchema = z.object({
  check: z.boolean().default(false).optional(),
});

export const CheckboxField = ({ field, recipient }: CheckboxFieldProps) => {
  const router = useRouter();

  const { toast } = useToast();

  // const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const [localText, setLocalCustomText] = useState('');

  const form = useForm<z.infer<typeof CheckBoxSchema>>({
    resolver: zodResolver(CheckBoxSchema),
    defaultValues: {
      check: true,
    },
  });

  const onPreSign = () => {
    if (!localText) {
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

  const onSubmit = (data: z.infer<typeof CheckBoxSchema>) => {
    console.log(data);
  };

  return (
    <SigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      type="Checkbox"
      raw={true}
    >
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        // TODO: span with a box
        // <p className="group-hover:text-primary text-muted-foreground text-lg duration-200">
        //   Checkbox
        // </p>

        <Checkbox
          id={`field-${field.id}`}
          onClick={() => {
            console.log('clicked checkbox');
          }}
          onCheckedChange={(checked) => {
            setLocalCustomText(checked ? '✓' : '𐄂');
          }}
        />
      )}

      {field.inserted && <p className="text-muted-foreground duration-200">{field.customText}</p>}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="check"
            render={({ field }) => (
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            )}
          />
        </form>
      </Form>
    </SigningFieldContainer>
  );
};
