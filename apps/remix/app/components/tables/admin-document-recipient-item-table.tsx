import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { type Field, type Recipient, type Signature, SigningStatus } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
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
    fields: Array<
      Field & {
        signature: Signature | null;
      }
    >;
  };
};

export const AdminDocumentRecipientItemTable = ({ recipient }: RecipientItemProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const form = useForm<TAdminUpdateRecipientFormSchema>({
    defaultValues: {
      name: recipient.name,
      email: recipient.email,
    },
  });

  const { mutateAsync: updateRecipient } = trpc.admin.recipient.update.useMutation();

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`ID`),
        accessorKey: 'id',
        cell: ({ row }) => <div>{row.original.id}</div>,
      },
      {
        header: _(msg`Type`),
        accessorKey: 'type',
        cell: ({ row }) => <div>{row.original.type}</div>,
      },
      {
        header: _(msg`Inserted`),
        accessorKey: 'inserted',
        cell: ({ row }) => <div>{row.original.inserted ? 'True' : 'False'}</div>,
      },
      {
        header: _(msg`Value`),
        accessorKey: 'customText',
        cell: ({ row }) => <div>{row.original.customText}</div>,
      },
      {
        header: _(msg`Signature`),
        accessorKey: 'signature',
        cell: ({ row }) => (
          <div>
            {row.original.signature?.typedSignature && (
              <span>{row.original.signature.typedSignature}</span>
            )}

            {row.original.signature?.signatureImageAsBase64 && (
              <img
                src={row.original.signature.signatureImageAsBase64}
                alt="Signature"
                className="h-12 w-full dark:invert"
              />
            )}
          </div>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof recipient)['fields'][number]>[];
  }, []);

  const onUpdateRecipientFormSubmit = async ({ name, email }: TAdminUpdateRecipientFormSchema) => {
    try {
      await updateRecipient({
        id: recipient.id,
        name,
        email,
      });

      toast({
        title: _(msg`Recipient updated`),
        description: _(msg`The recipient has been updated successfully`),
      });

      await revalidate();
    } catch (error) {
      toast({
        title: _(msg`Failed to update recipient`),
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
                  <FormLabel required>
                    <Trans>Name</Trans>
                  </FormLabel>

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
                  <FormLabel required>
                    <Trans>Email</Trans>
                  </FormLabel>

                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <Button type="submit" loading={form.formState.isSubmitting}>
                <Trans>Update Recipient</Trans>
              </Button>
            </div>
          </fieldset>
        </form>
      </Form>

      <hr className="my-4" />

      <h2 className="mb-4 text-lg font-semibold">
        <Trans>Fields</Trans>
      </h2>

      <DataTable columns={columns} data={recipient.fields} />
    </div>
  );
};
