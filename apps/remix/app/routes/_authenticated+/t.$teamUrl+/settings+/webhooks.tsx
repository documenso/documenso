import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { DateTime } from 'luxon';
import { Link } from 'react-router';

import { toFriendlyWebhookEventName } from '@documenso/lib/universal/webhook/to-friendly-webhook-event-name';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';

import { WebhookCreateDialog } from '~/components/dialogs/webhook-create-dialog';
import { WebhookDeleteDialog } from '~/components/dialogs/webhook-delete-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';

export default function WebhookPage() {
  const { _, i18n } = useLingui();

  const team = useCurrentTeam();

  const { data: webhooks, isLoading } = trpc.webhook.getTeamWebhooks.useQuery({
    teamId: team.id,
  });

  return (
    <div>
      <SettingsHeader
        title={_(msg`Webhooks`)}
        subtitle={_(msg`On this page, you can create new Webhooks and manage the existing ones.`)}
      >
        <WebhookCreateDialog />
      </SettingsHeader>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      )}
      {webhooks && webhooks.length === 0 && (
        // TODO: Perhaps add some illustrations here to make the page more engaging
        <div className="mb-4">
          <p className="text-muted-foreground mt-2 text-sm italic">
            <Trans>
              You have no webhooks yet. Your webhooks will be shown here once you create them.
            </Trans>
          </p>
        </div>
      )}
      {webhooks && webhooks.length > 0 && (
        <div className="mt-4 flex max-w-xl flex-col gap-y-4">
          {webhooks?.map((webhook) => (
            <div
              key={webhook.id}
              className={cn(
                'border-border rounded-lg border p-4',
                !webhook.enabled && 'bg-muted/40',
              )}
            >
              <div className="flex flex-col gap-x-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="truncate font-mono text-xs">{webhook.id}</div>

                  <div className="mt-1.5 flex items-center gap-2">
                    <h5
                      className="max-w-[30rem] truncate text-sm sm:max-w-[18rem]"
                      title={webhook.webhookUrl}
                    >
                      {webhook.webhookUrl}
                    </h5>

                    <Badge variant={webhook.enabled ? 'neutral' : 'warning'} size="small">
                      {webhook.enabled ? <Trans>Enabled</Trans> : <Trans>Disabled</Trans>}
                    </Badge>
                  </div>

                  <p className="text-muted-foreground mt-2 text-xs">
                    <Trans>
                      Listening to{' '}
                      {webhook.eventTriggers
                        .map((trigger) => toFriendlyWebhookEventName(trigger))
                        .join(', ')}
                    </Trans>
                  </p>

                  <p className="text-muted-foreground mt-2 text-xs">
                    <Trans>Created on {i18n.date(webhook.createdAt, DateTime.DATETIME_FULL)}</Trans>
                  </p>
                </div>

                <div className="mt-4 flex flex-shrink-0 gap-4 sm:mt-0">
                  <Button asChild variant="outline">
                    <Link to={`/t/${team.url}/settings/webhooks/${webhook.id}`}>
                      <Trans>Edit</Trans>
                    </Link>
                  </Button>
                  <WebhookDeleteDialog webhook={webhook}>
                    <Button variant="destructive">
                      <Trans>Delete</Trans>
                    </Button>
                  </WebhookDeleteDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
