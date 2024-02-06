'use client';

import { Zap } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { DeleteWebhookDialog } from '~/components/(dashboard)/settings/webhooks/delete-webhook-dialog';

export default function WebhookPage() {
  // TODO: Fetch webhooks from the DB after implementing the backend
  const webhooks = [
    {
      id: 1,
      secret: 'my-secret',
      webhookUrl: 'https://example.com/webhook',
      eventTriggers: ['document.created', 'document.signed'],
      enabled: true,
      userID: 1,
    },
  ];

  return (
    <div>
      <SettingsHeader
        title="Webhooks"
        subtitle="On this page, you can create new Webhooks and manage the existing ones."
      >
        <Button variant="default">Create Webhook</Button>
      </SettingsHeader>

      {webhooks.length === 0 && (
        // TODO: Perhaps add some illustrations here to make the page more engaging
        <div className="mb-4">
          <p className="text-muted-foreground mt-2 text-sm italic">
            You have no webhooks yet. Your webhooks will be shown here once you create them.
          </p>
        </div>
      )}

      {webhooks.length > 0 && (
        <div className="mt-4 flex max-w-xl flex-col gap-y-4">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="border-border rounded-lg border p-4">
              <div className="flex items-center justify-between gap-x-4">
                <div>
                  <h4 className="text-lg font-semibold">Webhook URL</h4>
                  <p className="text-muted-foreground">{webhook.webhookUrl}</p>
                  <h4 className="mt-4 text-lg font-semibold">Event triggers</h4>
                  {webhook.eventTriggers.map((trigger, index) => (
                    <p key={index} className="text-muted-foreground flex flex-row items-center">
                      <Zap className="mr-1 h-4 w-4 fill-yellow-400 stroke-yellow-600" /> {trigger}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex flex-col-reverse space-y-2 space-y-reverse sm:flex-row sm:justify-end sm:space-x-2 sm:space-y-0">
                <Button variant="secondary" className="">
                  Edit
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
