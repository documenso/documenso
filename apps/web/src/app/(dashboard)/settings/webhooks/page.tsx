'use client';

import Link from 'next/link';

import { Zap } from 'lucide-react';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { Loader } from 'lucide-react';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { CreateWebhookDialog } from '~/components/(dashboard)/settings/webhooks/create-webhook-dialog';
import { DeleteWebhookDialog } from '~/components/(dashboard)/settings/webhooks/delete-webhook-dialog';

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
            <div key={webhook.id} className="border-border rounded-lg border p-4">
              <div className="flex items-center justify-between gap-x-4">
                <div>
                  <h4 className="text-lg font-semibold">Webhook URL</h4>
                  <p className="text-muted-foreground">{webhook.webhookUrl}</p>
                  <h4 className="mt-4 text-lg font-semibold">Event triggers</h4>
                  {webhook.eventTriggers.map((trigger, index) => (
                    <span key={index} className="text-muted-foreground flex flex-row items-center">
                      <Zap className="mr-1 h-4 w-4" /> {trigger}
                    </span>
                  ))}
                  {webhook.enabled ? (
                    <h4 className="mt-4 flex items-center gap-2 text-lg">
                      Active <ToggleRight className="h-6 w-6 fill-green-200 stroke-green-400" />
                    </h4>
                  ) : (
                    <h4 className="mt-4 flex items-center gap-2 text-lg">
                      Inactive <ToggleLeft className="h-6 w-6 fill-slate-200 stroke-slate-400" />
                    </h4>
                  )}
                </div>
              </div>
              <div className="flex flex-col-reverse space-y-2 space-y-reverse sm:flex-row sm:justify-end sm:space-x-2 sm:space-y-0">
                <Button asChild variant="outline">
                  <Link href={`/settings/webhooks/${webhook.id}`}>Edit</Link>
                </Button>
                <DeleteWebhookDialog webhook={webhook}>
                  <Button variant="destructive">Delete</Button>
                </DeleteWebhookDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
