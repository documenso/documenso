import { useMemo, useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { WebhookCallStatus } from '@prisma/client';
import { RotateCwIcon } from 'lucide-react';
import { createCallable } from 'react-call';

import { toFriendlyWebhookEventName } from '@documenso/lib/universal/webhook/to-friendly-webhook-event-name';
import { trpc } from '@documenso/trpc/react';
import type { TFindWebhookCallsResponse } from '@documenso/trpc/server/webhook-router/find-webhook-calls.types';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Sheet, SheetContent, SheetTitle } from '@documenso/ui/primitives/sheet';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type WebhookLogsSheetProps = {
  webhookCall: TFindWebhookCallsResponse['data'][number];
};

export const WebhookLogsSheet = createCallable<WebhookLogsSheetProps, string | null>(
  ({ call, webhookCall: initialWebhookCall }) => {
    const { t } = useLingui();
    const { toast } = useToast();

    const [webhookCall, setWebhookCall] = useState(initialWebhookCall);

    const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');

    const { mutateAsync: resendWebhookCall, isPending: isResending } =
      trpc.webhook.calls.resend.useMutation({
        onSuccess: (result) => {
          toast({ title: t`Webhook successfully sent` });

          setWebhookCall(result);
        },
        onError: () => {
          toast({ title: t`Something went wrong` });
        },
      });

    const generalWebhookDetails = useMemo(() => {
      return [
        {
          header: t`Status`,
          value: webhookCall.status === WebhookCallStatus.SUCCESS ? t`Success` : t`Failed`,
        },
        {
          header: t`Event`,
          value: toFriendlyWebhookEventName(webhookCall.event),
        },
        {
          header: t`Sent`,
          value: new Date(webhookCall.createdAt).toLocaleString(),
        },
        {
          header: t`Response Code`,
          value: webhookCall.responseCode,
        },
        {
          header: t`Destination`,
          value: webhookCall.url,
        },
      ];
    }, [webhookCall]);

    return (
      <Sheet open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <SheetContent position="right" size="lg" className="max-w-2xl overflow-y-auto">
          <SheetTitle>
            <h2 className="text-lg font-semibold">
              <Trans>Webhook Details</Trans>
            </h2>
            <p className="text-muted-foreground font-mono text-xs">{webhookCall.id}</p>
          </SheetTitle>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="mt-6">
              <div className="flex items-end justify-between">
                <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                  <Trans>Details</Trans>
                </h4>

                <Button
                  onClick={() =>
                    resendWebhookCall({
                      webhookId: webhookCall.webhookId,
                      webhookCallId: webhookCall.id,
                    })
                  }
                  tabIndex={-1}
                  loading={isResending}
                  size="sm"
                  className="mb-2"
                >
                  {!isResending && <RotateCwIcon className="mr-2 h-3.5 w-3.5" />}
                  <Trans>Resend</Trans>
                </Button>
              </div>
              <div className="border-border overflow-hidden rounded-lg border">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-border bg-muted/30 divide-y">
                    {generalWebhookDetails.map(({ header, value }, index) => (
                      <tr key={index}>
                        <td className="text-muted-foreground border-border w-1/3 border-r px-4 py-2 font-mono text-xs">
                          {header}
                        </td>
                        <td className="text-foreground break-all px-4 py-2 font-mono text-xs">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payload Tabs */}
            <div className="py-6">
              <div className="border-border mb-4 flex items-center gap-4 border-b">
                <button
                  onClick={() => setActiveTab('request')}
                  className={cn(
                    'relative pb-2 text-sm font-medium transition-colors',
                    activeTab === 'request'
                      ? 'text-foreground after:bg-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Trans>Request</Trans>
                </button>

                <button
                  onClick={() => setActiveTab('response')}
                  className={cn(
                    'relative pb-2 text-sm font-medium transition-colors',
                    activeTab === 'response'
                      ? 'text-foreground after:bg-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Trans>Response</Trans>
                </button>
              </div>

              <div className="group relative">
                <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <CopyTextButton
                    value={JSON.stringify(
                      activeTab === 'request' ? webhookCall.requestBody : webhookCall.responseBody,
                      null,
                      2,
                    )}
                    onCopySuccess={() => toast({ title: t`Copied to clipboard` })}
                  />
                </div>
                <pre className="bg-muted/50 border-border text-foreground overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-relaxed">
                  {JSON.stringify(
                    activeTab === 'request' ? webhookCall.requestBody : webhookCall.responseBody,
                    null,
                    2,
                  )}
                </pre>
              </div>

              {activeTab === 'response' && (
                <div className="mt-6">
                  <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                    <Trans>Response Headers</Trans>
                  </h4>
                  <div className="border-border overflow-hidden rounded-lg border">
                    <table className="w-full text-left text-sm">
                      <tbody className="divide-border bg-muted/30 divide-y">
                        {Object.entries(webhookCall.responseHeaders as Record<string, string>).map(
                          ([key, value]) => (
                            <tr key={key}>
                              <td className="text-muted-foreground border-border w-1/3 border-r px-4 py-2 font-mono text-xs">
                                {key}
                              </td>
                              <td className="text-foreground break-all px-4 py-2 font-mono text-xs">
                                {value as string}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  },
);
