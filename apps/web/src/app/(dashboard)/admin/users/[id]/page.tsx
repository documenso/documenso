'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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

import { DeleteUserDialog } from './delete-user-dialog';
import { MultiSelectRoleCombobox } from './multiselect-role-combobox';

const ZUserFormSchema = ZAdminUpdateProfileMutationSchema.omit({ id: true });

type TUserFormSchema = z.infer<typeof ZUserFormSchema>;

export default function UserPage({ params }: { params: { id: number } }) {
  const { toast } = useToast();
  const router = useRouter();

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

      router.refresh();

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated.',
        duration: 5000,
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'An error occurred while updating your profile.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div>
      <h2 className="text-4xl font-semibold">Manage {user?.name}'s profile</h2>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset className="mt-6 flex w-full flex-col gap-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Name</FormLabel>
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
                  <FormLabel className="text-muted-foreground">Email</FormLabel>
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
                    <FormLabel className="text-muted-foreground">Roles</FormLabel>
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
                Update user
              </Button>
            </div>
          </fieldset>
        </form>
      </Form>

      <hr className="my-4" />

      {user && <DeleteUserDialog user={user} />}
    </div>
  );
}
