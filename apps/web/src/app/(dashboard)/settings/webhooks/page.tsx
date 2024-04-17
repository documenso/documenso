'use client';

import Link from 'next/link';

import { Loader } from 'lucide-react';
import { DateTime } from 'luxon';

import { toFriendlyWebhookEventName } from '@documenso/lib/universal/webhook/to-friendly-webhook-event-name';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { CreateWebhookDialog } from '~/components/(dashboard)/settings/webhooks/create-webhook-dialog';
import { DeleteWebhookDialog } from '~/components/(dashboard)/settings/webhooks/delete-webhook-dialog';
import { LocaleDate } from '~/components/formatter/locale-date';

export default function WebhookPage() {
  const { data: webhooks, isLoading } = trpc.webhook.getWebhooks.useQuery();

  return (
    <div>
      <SettingsHeader
        title="Webhooks"
        subtitle="On this page, you can create new Webhooks and manage the existing ones."
      >
        <CreateWebhookDialog />
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
            You have no webhooks yet. Your webhooks will be shown here once you create them.
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

                  <div className="mt-1.5 flex items-center gap-4">
                    <h5
                      className="max-w-[30rem] truncate text-sm sm:max-w-[18rem]"
                      title={webhook.webhookUrl}
                    >
                      {webhook.webhookUrl}
                    </h5>

                    <Badge variant={webhook.enabled ? 'neutral' : 'warning'} size="small">
                      {webhook.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>

                  <p className="text-muted-foreground mt-2 text-xs">
                    Listening to{' '}
                    {webhook.eventTriggers
                      .map((trigger) => toFriendlyWebhookEventName(trigger))
                      .join(', ')}
                  </p>

                  <p className="text-muted-foreground mt-2 text-xs">
                    Created on{' '}
                    <LocaleDate date={webhook.createdAt} format={DateTime.DATETIME_FULL} />
                  </p>
                </div>

                <div className="mt-4 flex flex-shrink-0 gap-4 sm:mt-0">
                  <Button asChild variant="outline">
                    <Link href={`/settings/webhooks/${webhook.id}`}>Edit</Link>
                  </Button>
                  <DeleteWebhookDialog webhook={webhook}>
                    <Button variant="destructive">Delete</Button>
                  </DeleteWebhookDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
