import { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import type { z } from 'zod';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { IS_BILLING_ENABLED, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateTeamRequestSchema } from '@documenso/trpc/server/team-router/create-team.types';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
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
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type TeamCreateDialogProps = {
  trigger?: React.ReactNode;
  onCreated?: () => Promise<void>;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZCreateTeamFormSchema = ZCreateTeamRequestSchema.pick({
  teamName: true,
  teamUrl: true,
  inheritMembers: true,
});

type TCreateTeamFormSchema = z.infer<typeof ZCreateTeamFormSchema>;

export const TeamCreateDialog = ({ trigger, onCreated, ...props }: TeamCreateDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useSession();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();
  const organisation = useCurrentOrganisation();

  const [open, setOpen] = useState(false);

  const { data: fullOrganisation } = trpc.organisation.get.useQuery({
    organisationReference: organisation.id,
  });

  const actionSearchParam = searchParams?.get('action');

  const form = useForm({
    resolver: zodResolver(ZCreateTeamFormSchema),
    defaultValues: {
      teamName: '',
      teamUrl: '',
      inheritMembers: true,
    },
  });

  const { mutateAsync: createTeam } = trpc.team.create.useMutation();

  const onFormSubmit = async ({ teamName, teamUrl, inheritMembers }: TCreateTeamFormSchema) => {
    try {
      await createTeam({
        organisationId: organisation.id,
        teamName,
        teamUrl,
        inheritMembers,
      });

      setOpen(false);

      await onCreated?.();
      await refreshSession();

      toast({
        title: _(msg`Success`),
        description: _(msg`Your team has been created.`),
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.ALREADY_EXISTS) {
        form.setError('teamUrl', {
          type: 'manual',
          message: _(msg`This URL is already in use.`),
        });

        return;
      }

      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to create a team. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  const mapTextToUrl = (text: string) => {
    return text.toLowerCase().replace(/\s+/g, '-');
  };

  const dialogState = useMemo(() => {
    if (!fullOrganisation) {
      return 'loading';
    }

    if (!IS_BILLING_ENABLED()) {
      return 'form';
    }

    if (fullOrganisation.organisationClaim.teamCount === 0) {
      return 'form';
    }

    if (fullOrganisation.organisationClaim.teamCount <= fullOrganisation.teams.length) {
      return 'alert';
    }

    return 'form';
  }, [fullOrganisation]);

  useEffect(() => {
    if (actionSearchParam === 'add-team') {
      setOpen(true);
      updateSearchParams({ action: null });
    }
  }, [actionSearchParam, open]);

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
            <Trans>Create team</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Create team</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Create a team to collaborate with your team members.</Trans>
          </DialogDescription>
        </DialogHeader>

        {dialogState === 'loading' && <SpinnerBox className="py-32" />}

        {dialogState === 'alert' && (
          <>
            <Alert
              className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
              variant="neutral"
            >
              <AlertDescription className="mr-2">
                <Trans>
                  You have reached the maximum number of teams for your plan. Please contact sales
                  at <a href="mailto:support@documenso.com">support@documenso.com</a> if you would
                  like to adjust your plan.
                </Trans>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                <Trans>Cancel</Trans>
              </Button>
            </DialogFooter>
          </>
        )}

        {dialogState === 'form' && (
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
                      <FormLabel required>
                        <Trans>Team Name</Trans>
                      </FormLabel>
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
                      <FormLabel required>
                        <Trans>Team URL</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input className="bg-background" {...field} />
                      </FormControl>
                      {!form.formState.errors.teamUrl && (
                        <span className="text-foreground/50 text-xs font-normal">
                          {field.value ? (
                            `${NEXT_PUBLIC_WEBAPP_URL()}/t/${field.value}`
                          ) : (
                            <Trans>A unique URL to identify your team</Trans>
                          )}
                        </span>
                      )}

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inheritMembers"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <div className="flex items-center">
                          <Checkbox
                            id="inherit-members"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />

                          <label
                            className="text-muted-foreground ml-2 text-sm"
                            htmlFor="inherit-members"
                          >
                            <Trans>Allow all organisation members to access this team</Trans>
                          </label>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button
                    type="submit"
                    data-testid="dialog-create-team-button"
                    loading={form.formState.isSubmitting}
                  >
                    <Trans>Create Team</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
