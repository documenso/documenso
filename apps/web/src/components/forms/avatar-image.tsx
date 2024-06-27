'use client';

import { useMemo } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorCode, useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { base64 } from '@documenso/lib/universal/base64';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import type { Team, User } from '@documenso/prisma/client';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZAvatarImageFormSchema = z.object({
  bytes: z.string().nullish(),
});

export type TAvatarImageFormSchema = z.infer<typeof ZAvatarImageFormSchema>;

export type AvatarImageFormProps = {
  className?: string;
  user: User;
  team?: Team;
};

export const AvatarImageForm = ({ className, user, team }: AvatarImageFormProps) => {
  const { toast } = useToast();
  const router = useRouter();

  const { mutateAsync: setProfileImage } = trpc.profile.setProfileImage.useMutation();

  const initials = extractInitials(team?.name || user.name || '');

  const hasAvatarImage = useMemo(() => {
    if (team) {
      return team.avatarImageId !== null;
    }

    return user.avatarImageId !== null;
  }, [team, user.avatarImageId]);

  const avatarImageId = team ? team.avatarImageId : user.avatarImageId;

  const form = useForm<TAvatarImageFormSchema>({
    values: {
      bytes: null,
    },
    resolver: zodResolver(ZAvatarImageFormSchema),
  });

  const { getRootProps, getInputProps } = useDropzone({
    maxSize: 1024 * 1024,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
    multiple: false,
    onDropAccepted: ([file]) => {
      void file.arrayBuffer().then((buffer) => {
        const contents = base64.encode(new Uint8Array(buffer));

        form.setValue('bytes', contents);
        void form.handleSubmit(onFormSubmit)();
      });
    },
    onDropRejected: ([file]) => {
      form.setError('bytes', {
        type: 'onChange',
        message: match(file.errors[0].code)
          .with(ErrorCode.FileTooLarge, () => 'Uploaded file is too large')
          .with(ErrorCode.FileTooSmall, () => 'Uploaded file is too small')
          .with(ErrorCode.FileInvalidType, () => 'Uploaded file not an allowed file type')
          .otherwise(() => 'An unknown error occurred'),
      });
    },
  });

  const onFormSubmit = async (data: TAvatarImageFormSchema) => {
    try {
      await setProfileImage({
        bytes: data.bytes,
        teamId: team?.id,
      });

      toast({
        title: 'Avatar Updated',
        description: 'Your avatar has been updated successfully.',
        duration: 5000,
      });

      router.refresh();
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'An error occurred',
          description: err.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'An unknown error occurred',
          variant: 'destructive',
          description:
            'We encountered an unknown error while attempting to update the avatar. Please try again later.',
        });
      }
    }
  };

  return (
    <Form {...form}>
      <form
        className={cn('flex w-full flex-col gap-y-4', className)}
        // onSubmit={form.handleSubmit(onFormSubmit)}
      >
        <fieldset className="flex w-full flex-col gap-y-4" disabled={form.formState.isSubmitting}>
          <FormField
            control={form.control}
            name="bytes"
            render={() => (
              <FormItem>
                <FormLabel>Avatar</FormLabel>

                <FormControl>
                  <div className="flex items-center gap-8">
                    <div className="relative">
                      <Avatar className="h-16 w-16 border-2 border-solid">
                        {avatarImageId && (
                          <AvatarImage
                            src={`${NEXT_PUBLIC_WEBAPP_URL()}/api/avatar/${avatarImageId}`}
                          />
                        )}
                        <AvatarFallback className="text-sm text-gray-400">
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      {hasAvatarImage && (
                        <button
                          type="button"
                          className="bg-background/70 text-destructive absolute inset-0 flex cursor-pointer items-center justify-center text-xs opacity-0 transition-opacity hover:opacity-100"
                          disabled={form.formState.isSubmitting}
                          onClick={() => void onFormSubmit({ bytes: null })}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      {...getRootProps()}
                      loading={form.formState.isSubmitting}
                      disabled={form.formState.isSubmitting}
                    >
                      Upload Avatar
                      <input {...getInputProps()} />
                    </Button>
                  </div>
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>
      </form>
    </Form>
  );
};
