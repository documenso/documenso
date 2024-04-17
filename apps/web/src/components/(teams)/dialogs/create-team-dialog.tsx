'use client';

import { useEffect, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateTeamMutationSchema } from '@documenso/trpc/server/team-router/schema';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
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

export type CreateTeamDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZCreateTeamFormSchema = ZCreateTeamMutationSchema.pick({
  teamName: true,
  teamUrl: true,
});

type TCreateTeamFormSchema = z.infer<typeof ZCreateTeamFormSchema>;

export const CreateTeamDialog = ({ trigger, ...props }: CreateTeamDialogProps) => {
  const { toast } = useToast();

  const router = useRouter();
  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const [open, setOpen] = useState(false);

  const actionSearchParam = searchParams?.get('action');

  const form = useForm({
    resolver: zodResolver(ZCreateTeamFormSchema),
    defaultValues: {
      teamName: '',
      teamUrl: '',
    },
  });

  const { mutateAsync: createTeam } = trpc.team.createTeam.useMutation();

  const onFormSubmit = async ({ teamName, teamUrl }: TCreateTeamFormSchema) => {
    try {
      const response = await createTeam({
        teamName,
        teamUrl,
      });

      setOpen(false);

      if (response.paymentRequired) {
        router.push(`/settings/teams?tab=pending&checkout=${response.pendingTeamId}`);
        return;
      }

      toast({
        title: 'Success',
        description: 'Your team has been created.',
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.ALREADY_EXISTS) {
        form.setError('teamUrl', {
          type: 'manual',
          message: 'This URL is already in use.',
        });

        return;
      }

      toast({
        title: 'An unknown error occurred',
        variant: 'destructive',
        description:
          'We encountered an unknown error while attempting to create a team. Please try again later.',
      });
    }
  };

  const mapTextToUrl = (text: string) => {
    return text.toLowerCase().replace(/\s+/g, '-');
  };

  useEffect(() => {
    if (actionSearchParam === 'add-team') {
      setOpen(true);
      updateSearchParams({ action: null });
    }
  }, [actionSearchParam, open, setOpen, updateSearchParams]);

  useEffect(() => {
    form.reset();
  }, [open, form]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button className="flex-shrink-0" variant="secondary">
            Create team
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>

          <DialogDescription className="mt-4">
            Create a team to collaborate with your team members.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <FormField
                control={form.control}
                name="teamName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Team Name</FormLabel>
                    <FormControl>
                      <Input
                        className="bg-background"
                        {...field}
                        onChange={(event) => {
                          const oldGeneratedUrl = mapTextToUrl(field.value);
                          const newGeneratedUrl = mapTextToUrl(event.target.value);

                          const urlField = form.getValues('teamUrl');
                          if (urlField === oldGeneratedUrl) {
                            form.setValue('teamUrl', newGeneratedUrl);
                          }

                          field.onChange(event);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="teamUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Team URL</FormLabel>
                    <FormControl>
                      <Input className="bg-background" {...field} />
                    </FormControl>
                    {!form.formState.errors.teamUrl && (
                      <span className="text-foreground/50 text-xs font-normal">
                        {field.value
                          ? `${WEBAPP_BASE_URL}/t/${field.value}`
                          : 'A unique URL to identify your team'}
                      </span>
                    )}

                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>

                <Button
                  type="submit"
                  data-testid="dialog-create-team-button"
                  loading={form.formState.isSubmitting}
                >
                  Create Team
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
