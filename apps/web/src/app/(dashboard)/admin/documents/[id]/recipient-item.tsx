'use client';

import { useRouter } from 'next/navigation';

import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  type Field,
  type Recipient,
  type Signature,
  SigningStatus,
} from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable } from '@documenso/ui/primitives/data-table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZAdminUpdateRecipientFormSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

type TAdminUpdateRecipientFormSchema = z.infer<typeof ZAdminUpdateRecipientFormSchema>;

export type RecipientItemProps = {
  recipient: Recipient & {
    Field: Array<
      Field & {
        Signature: Signature | null;
      }
    >;
  };
};

export const RecipientItem = ({ recipient }: RecipientItemProps) => {
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<TAdminUpdateRecipientFormSchema>({
    defaultValues: {
      name: recipient.name,
      email: recipient.email,
    },
  });

  const { mutateAsync: updateRecipient } = trpc.admin.updateRecipient.useMutation();

  const onUpdateRecipientFormSubmit = async ({ name, email }: TAdminUpdateRecipientFormSchema) => {
    try {
      await updateRecipient({
        id: recipient.id,
        name,
        email,
      });

      toast({
        title: 'მიმღები განახლებულია',
        description: 'მიმღები წარმატებით განახლდა',
      });

      router.refresh();
    } catch (error) {
      toast({
        title: 'მიმღების განახლება ვერ მოხერხდა',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onUpdateRecipientFormSubmit)}>
          <fieldset
            className="flex h-full max-w-xl flex-col gap-y-4"
            disabled={
              form.formState.isSubmitting || recipient.signingStatus === SigningStatus.SIGNED
            }
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel required>სახელი</FormLabel>

                  <FormControl>
                    <Input {...field} />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel required>ელ. ფოსტა</FormLabel>

                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <Button type="submit" loading={form.formState.isSubmitting}>
                მიმღების განახლება
              </Button>
            </div>
          </fieldset>
        </form>
      </Form>

      <hr className="my-4" />

      <h2 className="mb-4 text-lg font-semibold">ველები</h2>

      <DataTable
        data={recipient.Field}
        columns={[
          {
            header: 'ID',
            accessorKey: 'id',
            cell: ({ row }) => <div>{row.original.id}</div>,
          },
          {
            header: 'Type',
            accessorKey: 'type',
            cell: ({ row }) => <div>{row.original.type}</div>,
          },
          {
            header: 'Inserted',
            accessorKey: 'inserted',
            cell: ({ row }) => <div>{row.original.inserted ? 'True' : 'False'}</div>,
          },
          {
            header: 'Value',
            accessorKey: 'customText',
            cell: ({ row }) => <div>{row.original.customText}</div>,
          },
          {
            header: 'Signature',
            accessorKey: 'signature',
            cell: ({ row }) => (
              <div>
                {row.original.Signature?.typedSignature && (
                  <span>{row.original.Signature.typedSignature}</span>
                )}

                {row.original.Signature?.signatureImageAsBase64 && (
                  <img
                    src={row.original.Signature.signatureImageAsBase64}
                    alt="Signature"
                    className="h-12 w-full dark:invert"
                  />
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
