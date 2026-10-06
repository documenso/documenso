import { formatDocumentAuditLogAction } from '@documenso/lib/utils/document-audit-logs';
import { zEmail } from '@documenso/lib/utils/zod';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@documenso/ui/primitives/collapsible';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { type Field, type Recipient, RecipientRole, type Signature, SigningStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import { z } from 'zod';

import { AdminRecipientDeleteDialog } from '~/components/dialogs/admin-recipient-delete-dialog';

const RECIPIENT_ROLE_LABELS: Record<RecipientRole, string> = {
  [RecipientRole.SIGNER]: 'Signer',
  [RecipientRole.APPROVER]: 'Approver',
  [RecipientRole.CC]: 'CC',
  [RecipientRole.VIEWER]: 'Viewer',
  [RecipientRole.ASSISTANT]: 'Assistant',
};

const ZAdminUpdateRecipientFormSchema = z.object({
  name: z.string().min(1),
  email: zEmail(),
  role: z.nativeEnum(RecipientRole),
});

type TAdminUpdateRecipientFormSchema = z.infer<typeof ZAdminUpdateRecipientFormSchema>;

export type RecipientItemProps = {
  envelopeId: string;
  isDocumentCompleted: boolean;
  recipient: Recipient & {
    fields: Array<
      Field & {
        signature: Signature | null;
      }
    >;
  };
};

export const AdminDocumentRecipientItemTable = ({ envelopeId, isDocumentCompleted, recipient }: RecipientItemProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const isRecipientSigned = recipient.signingStatus === SigningStatus.SIGNED;

  let removeDisabledReason: string | undefined;

  if (isDocumentCompleted) {
    removeDisabledReason = _(msg`Recipients cannot be removed from a completed document.`);
  } else if (isRecipientSigned) {
    removeDisabledReason = _(msg`This recipient has already signed and cannot be removed.`);
  }

  const form = useForm<TAdminUpdateRecipientFormSchema>({
    defaultValues: {
      name: recipient.name,
      email: recipient.email,
      role: recipient.role,
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
            {row.original.signature?.typedSignature && <span>{row.original.signature.typedSignature}</span>}

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

  const onUpdateRecipientFormSubmit = async ({ name, email, role }: TAdminUpdateRecipientFormSchema) => {
    try {
      await updateRecipient({
        id: recipient.id,
        name,
        email,
        role,
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
      <div className="mb-4 grid grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">
            <Trans>Send Status</Trans>
          </span>
          <p className="font-medium">{recipient.sendStatus}</p>
        </div>

        <div>
          <span className="text-muted-foreground">
            <Trans>Read Status</Trans>
          </span>
          <p className="font-medium">{recipient.readStatus}</p>
        </div>

        <div>
          <span className="text-muted-foreground">
            <Trans>Signing Status</Trans>
          </span>
          <p className="font-medium">{recipient.signingStatus}</p>
        </div>

        <div>
          <span className="text-muted-foreground">
            <Trans>Signing Order</Trans>
          </span>
          <p className="font-medium">{recipient.signingOrder ?? '-'}</p>
        </div>
      </div>

      <hr className="mb-4" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onUpdateRecipientFormSubmit)}>
          <fieldset
            className="flex h-full max-w-xl flex-col gap-y-4"
            disabled={form.formState.isSubmitting || recipient.signingStatus === SigningStatus.SIGNED}
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

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel required>
                    <Trans>Role</Trans>
                  </FormLabel>

                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={form.formState.isSubmitting || recipient.signingStatus === SigningStatus.SIGNED}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {Object.values(RecipientRole).map((role) => (
                          <SelectItem key={role} value={role}>
                            {RECIPIENT_ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          <div className="mt-4 flex gap-x-4">
            <Button
              type="submit"
              loading={form.formState.isSubmitting}
              disabled={form.formState.isSubmitting || isRecipientSigned}
            >
              <Trans>Update Recipient</Trans>
            </Button>

            <AdminRecipientDeleteDialog
              recipientId={recipient.id}
              recipientName={recipient.name}
              recipientEmail={recipient.email}
              disabledReason={removeDisabledReason}
            />
          </div>
        </form>
      </Form>

      <hr className="my-4" />

      <h2 className="mb-4 font-semibold text-lg">
        <Trans>Fields</Trans>
      </h2>

      <DataTable className="bg-background" columns={columns} data={recipient.fields} />

      <hr className="my-4" />

      <RecipientActivity envelopeId={envelopeId} recipientId={recipient.id} />
    </div>
  );
};

const RecipientActivity = ({ envelopeId, recipientId }: { envelopeId: string; recipientId: number }) => {
  const { _, i18n } = useLingui();

  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading } = trpc.admin.document.findAuditLogs.useQuery(
    { envelopeId, recipientId, perPage: 50 },
    { enabled: isOpen },
  );

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Date`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt, DateTime.DATETIME_MED),
      },
      {
        header: _(msg`Action`),
        accessorKey: 'type',
        cell: ({ row }) => formatDocumentAuditLogAction(i18n, row.original).description,
      },
      {
        header: _(msg`IP Address`),
        accessorKey: 'ipAddress',
        cell: ({ row }) => row.original.ipAddress ?? '-',
      },
    ] satisfies DataTableColumnDef<NonNullable<typeof data>['data'][number]>[];
  }, []);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg">
          <Trans>Activity</Trans>
        </h2>

        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm">
            {isOpen ? <Trans>Hide</Trans> : <Trans>Show</Trans>}
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <DataTable
          className="bg-background"
          columns={columns}
          data={data?.data ?? []}
          skeleton={{ enable: isLoading, rows: 3 }}
        />
      </CollapsibleContent>
    </Collapsible>
  );
};
