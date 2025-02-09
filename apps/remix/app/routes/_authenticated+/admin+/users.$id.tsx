import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import type { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { ZAdminUpdateProfileMutationSchema } from '@documenso/trpc/server/admin-router/schema';
import { Button } from '@documenso/ui/primitives/button';
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

import { AdminUserDeleteDialog } from '~/components/dialogs/admin-user-delete-dialog';
import { AdminUserDisableDialog } from '~/components/dialogs/admin-user-disable-dialog';
import { AdminUserEnableDialog } from '~/components/dialogs/admin-user-enable-dialog';

import { MultiSelectRoleCombobox } from '../../../components/general/multiselect-role-combobox';

const ZUserFormSchema = ZAdminUpdateProfileMutationSchema.omit({ id: true });

type TUserFormSchema = z.infer<typeof ZUserFormSchema>;

export default function UserPage({ params }: { params: { id: number } }) {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { data: user } = trpc.profile.getUser.useQuery(
    {
      id: Number(params.id),
    },
    {
      enabled: !!params.id,
    },
  );

  const roles = user?.roles ?? [];

  const { mutateAsync: updateUserMutation } = trpc.admin.updateUser.useMutation();

  const form = useForm<TUserFormSchema>({
    resolver: zodResolver(ZUserFormSchema),
    values: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      roles: user?.roles ?? [],
    },
  });

  const onSubmit = async ({ name, email, roles }: TUserFormSchema) => {
    try {
      await updateUserMutation({
        id: Number(user?.id),
        name,
        email,
        roles,
      });

      await revalidate();

      toast({
        title: _(msg`Profile updated`),
        description: _(msg`Your profile has been updated.`),
        duration: 5000,
      });
    } catch (e) {
      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while updating your profile.`),
        variant: 'destructive',
      });
    }
  };

  return (
    <div>
      <h2 className="text-4xl font-semibold">
        <Trans>Manage {user?.name}'s profile</Trans>
      </h2>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset className="mt-6 flex w-full flex-col gap-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">
                    <Trans>Name</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input type="text" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">
                    <Trans>Email</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input type="text" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roles"
              render={({ field: { onChange } }) => (
                <FormItem>
                  <fieldset className="flex flex-col gap-2">
                    <FormLabel className="text-muted-foreground">
                      <Trans>Roles</Trans>
                    </FormLabel>
                    <FormControl>
                      <MultiSelectRoleCombobox
                        listValues={roles}
                        onChange={(values: string[]) => onChange(values)}
                      />
                    </FormControl>
                    <FormMessage />
                  </fieldset>
                </FormItem>
              )}
            />

            <div className="mt-4">
              <Button type="submit" loading={form.formState.isSubmitting}>
                <Trans>Update user</Trans>
              </Button>
            </div>
          </fieldset>
        </form>
      </Form>

      <hr className="my-4" />

      <div className="flex flex-col items-center gap-4">
        {user && <AdminUserDeleteDialog user={user} />}
        {user && user.disabled && <AdminUserEnableDialog userToEnable={user} />}
        {user && !user.disabled && <AdminUserDisableDialog userToDisable={user} />}
      </div>
    </div>
  );
}
