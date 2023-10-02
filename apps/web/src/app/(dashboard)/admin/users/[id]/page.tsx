'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Combobox } from '@documenso/ui/primitives/combobox';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { FormErrorMessage } from '../../../../../components/form/form-error-message';
import {
  TUserFormSchema,
  ZUserFormSchema,
} from '../../../../../providers/admin-user-profile-update.types';

export default function UserPage({ params }: { params: { id: number } }) {
  const { toast } = useToast();
  const router = useRouter();

  const result = trpc.profile.getUser.useQuery(
    {
      id: Number(params.id),
    },
    {
      enabled: !!params.id,
    },
  );

  const user = result.data;

  const roles = user?.roles;
  let rolesArr: string[] = [];

  if (roles) {
    rolesArr = Object.values(roles);
  }

  const { mutateAsync: updateUserMutation } = trpc.admin.updateUser.useMutation();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TUserFormSchema>({
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
      console.log(e);
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
      <form className="mt-6 flex w-full flex-col gap-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Label htmlFor="name" className="text-muted-foreground">
            Name
          </Label>
          <Input defaultValue={user?.name ?? ''} type="text" {...register('name')} />
          <FormErrorMessage className="mt-1.5" error={errors.name} />
        </div>
        <div>
          <Label htmlFor="email" className="text-muted-foreground">
            Email
          </Label>
          <Input defaultValue={user?.email} type="email" {...register('email')} />
          <FormErrorMessage className="mt-1.5" error={errors.email} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="roles" className="text-muted-foreground">
            User roles
          </Label>
          <Controller
            control={control}
            name="roles"
            render={({ field: { onChange } }) => (
              <Combobox listValues={rolesArr} onChange={(values: string[]) => onChange(values)} />
            )}
          />
          <FormErrorMessage className="mt-1.5" error={errors.roles} />
        </div>

        <div className="mt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader className="mr-2 h-5 w-5 animate-spin" />}
            Update user
          </Button>
        </div>
      </form>
    </div>
  );
}
