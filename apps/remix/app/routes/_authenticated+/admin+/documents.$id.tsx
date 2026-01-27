import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType, RecipientRole, SigningStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { Link, redirect } from 'react-router';

import { unsafeGetEntireEnvelope } from '@documenso/lib/server-only/admin/get-entire-document';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { trpc } from '@documenso/trpc/react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { AdminDocumentDeleteDialog } from '~/components/dialogs/admin-document-delete-dialog';
import { DocumentStatus } from '~/components/general/document/document-status';
import { AdminDocumentJobsTable } from '~/components/tables/admin-document-jobs-table';
import { AdminDocumentLogsTable } from '~/components/tables/admin-document-logs-table';
import { AdminDocumentRecipientItemTable } from '~/components/tables/admin-document-recipient-item-table';

import type { Route } from './+types/documents.$id';

export async function loader({ params }: Route.LoaderArgs) {
  const id = params.id;

  if (!id || !id.startsWith('envelope_')) {
    throw redirect('/admin/documents');
  }

  const envelope = await unsafeGetEntireEnvelope({
    id: {
      type: 'envelopeId',
      id,
    },
    type: EnvelopeType.DOCUMENT,
  });

  return { envelope };
}

export default function AdminDocumentDetailsPage({ loaderData }: Route.ComponentProps) {
  const { envelope } = loaderData;

  const { _, i18n } = useLingui();
  const { toast } = useToast();

  const { mutate: resealDocument, isPending: isResealDocumentLoading } =
    trpc.admin.document.reseal.useMutation({
      onSuccess: () => {
        toast({
          title: _(msg`Sealing job started`),
          description: _(msg`See the background jobs tab for the status`),
        });
      },
      onError: () => {
        toast({
          title: _(msg`Error`),
          description: _(msg`Failed to reseal document`),
          variant: 'destructive',
        });
      },
    });

  return (
    <div>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-x-4">
          <h1 className="text-2xl font-semibold">{envelope.title}</h1>
          <DocumentStatus status={envelope.status} />
        </div>

        {envelope.deletedAt && (
          <Badge size="large" variant="destructive">
            <Trans>Deleted</Trans>
          </Badge>
        )}
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        <div>
          <Trans>Document ID</Trans>: {mapSecondaryIdToDocumentId(envelope.secondaryId)}
        </div>

        <div>
          <Trans>Created on</Trans>: {i18n.date(envelope.createdAt, DateTime.DATETIME_MED)}
        </div>

        <div>
          <Trans>Last updated at</Trans>: {i18n.date(envelope.updatedAt, DateTime.DATETIME_MED)}
        </div>
      </div>

      <hr className="my-4" />

      <h2 className="text-lg font-semibold">
        <Trans>Admin Actions</Trans>
      </h2>

      <div className="mt-2 flex gap-x-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                loading={isResealDocumentLoading}
                disabled={envelope.recipients.some(
                  (recipient) =>
                    recipient.signingStatus !== SigningStatus.SIGNED &&
                    recipient.signingStatus !== SigningStatus.REJECTED &&
                    recipient.role !== RecipientRole.CC,
                )}
                onClick={() => resealDocument({ id: envelope.id })}
              >
                <Trans>Reseal document</Trans>
              </Button>
            </TooltipTrigger>

            <TooltipContent className="max-w-[40ch]">
              <Trans>
                Attempts sealing the document again, useful for after a code change has occurred to
                resolve an erroneous document.
              </Trans>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button variant="outline" asChild>
          <Link to={`/admin/users/${envelope.userId}`}>
            <Trans>Go to owner</Trans>
          </Link>
        </Button>
      </div>

      <hr className="my-4" />
      <h2 className="text-lg font-semibold">
        <Trans>Recipients</Trans>
      </h2>

      <div className="mt-4">
        <Accordion type="multiple" className="space-y-4">
          {envelope.recipients.map((recipient) => (
            <AccordionItem
              key={recipient.id}
              value={recipient.id.toString()}
              className="rounded-lg border"
            >
              <AccordionTrigger className="px-4">
                <div className="flex items-center gap-x-4">
                  <h4 className="font-semibold">{recipient.name}</h4>
                  <Badge size="small" variant="neutral">
                    {recipient.email}
                  </Badge>
                  <Badge size="small" variant="secondary">
                    {recipient.role}
                  </Badge>
                </div>
              </AccordionTrigger>

              <AccordionContent className="border-t px-4 pt-4">
                <AdminDocumentRecipientItemTable recipient={recipient} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <hr className="my-4" />

      <div className="mt-4">
        <AdminDocumentJobsTable envelopeId={envelope.id} />
      </div>

      <hr className="my-4" />

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="audit-logs" className="rounded-lg border">
          <AccordionTrigger className="px-4">
            <h2 className="text-lg font-semibold">
              <Trans>Audit Logs</Trans>
            </h2>
          </AccordionTrigger>

          <AccordionContent className="border-t px-4 pt-4">
            <AdminDocumentLogsTable envelopeId={envelope.id} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <hr className="my-4" />

      {envelope && <AdminDocumentDeleteDialog envelopeId={envelope.id} />}
    </div>
  );
}
