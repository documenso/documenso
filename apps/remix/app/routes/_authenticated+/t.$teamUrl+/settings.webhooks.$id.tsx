import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import { Link } from 'react-router';
import type { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { ZEditWebhookRequestSchema } from '@documenso/trpc/server/webhook-router/schema';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { Switch } from '@documenso/ui/primitives/switch';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { WebhookTestDialog } from '~/components/dialogs/webhook-test-dialog';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { SettingsHeader } from '~/components/general/settings-header';
import { WebhookMultiSelectCombobox } from '~/components/general/webhook-multiselect-combobox';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/settings.webhooks.$id';

const ZEditWebhookFormSchema = ZEditWebhookRequestSchema.omit({ id: true, teamId: true });

type TEditWebhookFormSchema = z.infer<typeof ZEditWebhookFormSchema>;

export function meta() {
  return appMetaTags('Webhooks');
}

export default function WebhookPage({ params }: Route.ComponentProps) {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const team = useCurrentTeam();

  const { data: webhook, isLoading } = trpc.webhook.getWebhookById.useQuery(
    {
      id: params.id,
      teamId: team.id,
    },
    { enabled: !!params.id && !!team.id },
  );

  const { mutateAsync: updateWebhook } = trpc.webhook.editWebhook.useMutation();

  const form = useForm<TEditWebhookFormSchema>({
    resolver: zodResolver(ZEditWebhookFormSchema),
    values: {
      webhookUrl: webhook?.webhookUrl ?? '',
      eventTriggers: webhook?.eventTriggers ?? [],
      secret: webhook?.secret ?? '',
      enabled: webhook?.enabled ?? true,
    },
  });

  const onSubmit = async (data: TEditWebhookFormSchema) => {
    try {
      await updateWebhook({
        id: params.id,
        teamId: team.id,
        ...data,
      });

      toast({
        title: _(msg`Webhook updated`),
        description: _(msg`The webhook has been updated successfully.`),
        duration: 5000,
      });

      await revalidate();
    } catch (err) {
      toast({
        title: _(msg`Failed to update webhook`),
        description: _(
          msg`We encountered an error while updating the webhook. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <SpinnerBox className="py-32" />;
  }

  // Todo: Update UI, currently out of place.
  if (!webhook) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Webhook not found`,
            subHeading: msg`404 Webhook not found`,
            message: msg`The webhook you are looking for may have been removed, renamed or may have never
                    existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/t/${team.url}/settings/webhooks`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  return (
    <div className="max-w-2xl">
      <SettingsHeader
        title={_(msg`Edit webhook`)}
        subtitle={_(msg`On this page, you can edit the webhook and its settings.`)}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset className="flex h-full flex-col gap-y-6" disabled={form.formState.isSubmitting}>
            <div className="flex flex-col-reverse gap-4 md:flex-row">
              <FormField
                control={form.control}
                name="webhookUrl"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel required>Webhook URL</FormLabel>
                    <FormControl>
                      <Input className="bg-background" {...field} />
                    </FormControl>

                    <FormDescription>
                      <Trans>The URL for Documenso to send webhook events to.</Trans>
                    </FormDescription>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Enabled</Trans>
                    </FormLabel>

                    <div>
                      <FormControl>
                        <Switch
                          className="bg-background"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="eventTriggers"
              render={({ field: { onChange, value } }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel required>
                    <Trans>Triggers</Trans>
                  </FormLabel>
                  <FormControl>
                    <WebhookMultiSelectCombobox
                      listValues={value}
                      onChange={(values: string[]) => {
                        onChange(values);
                      }}
                    />
                  </FormControl>

                  <FormDescription>
                    <Trans>The events that will trigger a webhook to be sent to your URL.</Trans>
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secret</FormLabel>
                  <FormControl>
                    <PasswordInput className="bg-background" {...field} value={field.value ?? ''} />
                  </FormControl>

                  <FormDescription>
                    <Trans>
                      A secret that will be sent to your URL so you can verify that the request has
                      been sent by Documenso.
                    </Trans>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4">
              <Button type="submit" loading={form.formState.isSubmitting}>
                <Trans>Update webhook</Trans>
              </Button>
            </div>
          </fieldset>
        </form>
      </Form>

      <Alert
        className="mt-6 flex flex-col items-center justify-between gap-4 p-6 md:flex-row"
        variant="neutral"
      >
        <div>
          <AlertTitle>
            <Trans>Test Webhook</Trans>
          </AlertTitle>
          <AlertDescription className="mr-2">
            <Trans>
              Send a test webhook with sample data to verify your integration is working correctly.
            </Trans>
          </AlertDescription>
        </div>

        <div className="flex-shrink-0">
          <WebhookTestDialog webhook={webhook}>
            <Button variant="outline" disabled={!webhook.enabled}>
              <Trans>Test Webhook</Trans>
            </Button>
          </WebhookTestDialog>
        </div>
      </Alert>
    </div>
  );
}
