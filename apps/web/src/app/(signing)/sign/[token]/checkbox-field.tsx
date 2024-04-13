'use client';

import { useCallback, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
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

  const form = useForm<z.infer<typeof CheckBoxSchema>>({
    resolver: zodResolver(CheckBoxSchema),
    defaultValues: {
      check: false,
    },
  });

  const onSign = useCallback(
    async (authOptions?: TRecipientActionAuth) => {
      try {
        await signFieldWithToken({
          token: recipient.token,
          fieldId: field.id,
          value: 'checked',
          isBase64: true,
          authOptions,
        });

        startTransition(() => router.refresh());
      } catch (err) {
        const error = AppError.parseError(err);

        if (error.code === AppErrorCode.UNAUTHORIZED) {
          throw error;
        }

        toast({
          title: 'Error',
          description: 'An error occurred while signing the document.',
          variant: 'destructive',
        });
      }
    },
    [field.id, recipient.token, router, signFieldWithToken, toast],
  );

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

  return (
    <SigningFieldContainer
      field={field}
      onSign={onSign}
      onRemove={onRemove}
      type="Checkbox"
      raw={true}
    >
      <Form {...form}>
        <form>
          <FormField
            control={form.control}
            name="check"
            render={({ field }) => (
              <FormControl>
                <Checkbox
                  checked={field.value}
                  className="h-8 w-8"
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            )}
          />
        </form>
      </Form>
    </SigningFieldContainer>
  );
};
