'use client';

import { Loader } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { FormErrorMessage } from '../../../../../components/form/form-error-message';

export default function UserPage({ params }: { params: { id: number } }) {
  const toast = useToast();

  const result = trpc.profile.getUser.useQuery(
    {
      id: Number(params.id),
    },
    {
      enabled: !!params.id,
    },
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  console.log(result.data);

  const onSubmit = async (data) => {
    console.log(data);
  };

  return (
    <div>
      <h2 className="text-4xl font-semibold">Manage {result.data?.name}'s profile</h2>
      <form className="mt-6 flex w-full flex-col gap-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Label htmlFor="name" className="text-muted-foreground">
            Name
          </Label>
          <Input placeholder={result.data?.name} type="text" register={'name'} />
          <FormErrorMessage className="mt-1.5" error={errors.name} />
        </div>
        <div>
          <Label htmlFor="email" className="text-muted-foreground">
            Email
          </Label>
          <Input placeholder={result.data?.email} type="text" register={'email'} />
          <FormErrorMessage className="mt-1.5" error={errors.email} />
        </div>
        <div>
          <Label htmlFor="signature" className="text-muted-foreground">
            Signature
          </Label>

          <div className="mt-2">
            <Controller
              control={control}
              name="signature"
              render={({ field: { onChange } }) => (
                <SignaturePad
                  className="h-44 w-full rounded-lg border bg-white backdrop-blur-sm dark:border-[#e2d7c5] dark:bg-[#fcf8ee]"
                  defaultValue={result.data?.signature ?? undefined}
                  onChange={(v) => onChange(v ?? '')}
                />
              )}
            />
            <FormErrorMessage className="mt-1.5" error={errors.signature} />
          </div>
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
