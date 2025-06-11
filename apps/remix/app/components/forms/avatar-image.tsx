import { useMemo } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { ErrorCode, useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { AppError } from '@documenso/lib/errors/app-error';
import { base64 } from '@documenso/lib/universal/base64';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
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
  team?: {
    id: number;
    name: string;
    avatarImageId: string | null;
  };
  organisation?: {
    id: string;
    name: string;
    avatarImageId: string | null;
  };
};

export const AvatarImageForm = ({ className, team, organisation }: AvatarImageFormProps) => {
  const { user, refreshSession } = useSession();
  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: setProfileImage } = trpc.profile.setProfileImage.useMutation();

  const initials = extractInitials(team?.name || organisation?.name || user.name || '');

  const hasAvatarImage = useMemo(() => {
    if (team) {
      return team.avatarImageId !== null;
    }

    if (organisation) {
      return organisation.avatarImageId !== null;
    }

    return user.avatarImageId !== null;
  }, [team, organisation, user.avatarImageId]);

  const avatarImageId = team
    ? team.avatarImageId
    : organisation
      ? organisation.avatarImageId
      : user.avatarImageId;

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
          .with(ErrorCode.FileTooLarge, () => _(msg`Uploaded file is too large`))
          .with(ErrorCode.FileTooSmall, () => _(msg`Uploaded file is too small`))
          .with(ErrorCode.FileInvalidType, () => _(msg`Uploaded file not an allowed file type`))
          .otherwise(() => _(msg`An unknown error occurred`)),
      });
    },
  });

  const onFormSubmit = async (data: TAvatarImageFormSchema) => {
    try {
      await setProfileImage({
        bytes: data.bytes,
        teamId: team?.id ?? null,
        organisationId: organisation?.id ?? null,
      });

      await refreshSession();

      toast({
        title: _(msg`Avatar Updated`),
        description: _(msg`Your avatar has been updated successfully.`),
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      const errorMessage = match(error.code).otherwise(
        () =>
          msg`We encountered an unknown error while attempting to update your password. Please try again later.`,
      );

      toast({
        title: _(msg`An error occurred`),
        description: _(errorMessage),
        variant: 'destructive',
      });
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
                <FormLabel>
                  <Trans>Avatar</Trans>
                </FormLabel>

                <FormControl>
                  <div className="flex items-center gap-8">
                    <div className="relative">
                      <Avatar className="h-16 w-16 border-2 border-solid">
                        {avatarImageId && <AvatarImage src={formatAvatarUrl(avatarImageId)} />}
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
                          <Trans>Remove</Trans>
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
                      <Trans>Upload Avatar</Trans>
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
