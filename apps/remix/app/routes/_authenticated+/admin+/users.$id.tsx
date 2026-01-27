import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import { Link } from 'react-router';
import type { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import type { TGetUserResponse } from '@documenso/trpc/server/admin-router/get-user.types';
import { ZUpdateUserRequestSchema } from '@documenso/trpc/server/admin-router/update-user.types';
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
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { AdminOrganisationCreateDialog } from '~/components/dialogs/admin-organisation-create-dialog';
import { AdminUserDeleteDialog } from '~/components/dialogs/admin-user-delete-dialog';
import { AdminUserDisableDialog } from '~/components/dialogs/admin-user-disable-dialog';
import { AdminUserEnableDialog } from '~/components/dialogs/admin-user-enable-dialog';
import { AdminUserResetTwoFactorDialog } from '~/components/dialogs/admin-user-reset-two-factor-dialog';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { AdminOrganisationsTable } from '~/components/tables/admin-organisations-table';

import { MultiSelectRoleCombobox } from '../../../components/general/multiselect-role-combobox';

const ZUserFormSchema = ZUpdateUserRequestSchema.omit({ id: true });

type TUserFormSchema = z.infer<typeof ZUserFormSchema>;

export default function UserPage({ params }: { params: { id: number } }) {
  const { data: user, isLoading: isLoadingUser } = trpc.admin.user.get.useQuery(
    {
      id: Number(params.id),
    },
    {
      enabled: !!params.id,
    },
  );

  if (isLoadingUser) {
    return <SpinnerBox className="py-32" />;
  }

  if (!user) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`User not found`,
            subHeading: msg`404 User not found`,
            message: msg`The user you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/admin/users`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  return <AdminUserPage user={user} />;
}

const AdminUserPage = ({ user }: { user: TGetUserResponse }) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const roles = user.roles ?? [];

  const { mutateAsync: updateUserMutation } = trpc.admin.user.update.useMutation();

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

      <hr className="my-8" />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold leading-none tracking-tight">
              <Trans>User Organisations</Trans>
            </h3>
            <p className="text-muted-foreground mt-1.5 text-sm">
              <Trans>Organisations that the user is a member of.</Trans>
            </p>
          </div>

          <AdminOrganisationCreateDialog
            ownerUserId={user.id}
            trigger={
              <Button variant="outline" size="sm">
                <Trans>Create Organisation</Trans>
              </Button>
            }
          />
        </div>

        <AdminOrganisationsTable
          memberUserId={user.id}
          showOwnerColumn={false}
          hidePaginationUntilOverflow
        />
      </div>

      <div className="mt-16 flex flex-col gap-4">
        {user && user.twoFactorEnabled && <AdminUserResetTwoFactorDialog user={user} />}
        {user && user.disabled && <AdminUserEnableDialog userToEnable={user} />}
        {user && !user.disabled && <AdminUserDisableDialog userToDisable={user} />}
        {user && <AdminUserDeleteDialog user={user} />}
      </div>
    </div>
  );
};
