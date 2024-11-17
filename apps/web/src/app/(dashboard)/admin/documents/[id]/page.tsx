import { Trans } from '@lingui/macro';
import { DateTime } from 'luxon';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getEntireDocument } from '@documenso/lib/server-only/admin/get-entire-document';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';
import { Badge } from '@documenso/ui/primitives/badge';

import { DocumentStatus } from '~/components/formatter/document-status';

import { AdminActions } from './admin-actions';
import { RecipientItem } from './recipient-item';
import { SuperDeleteDocumentDialog } from './super-delete-document-dialog';

type AdminDocumentDetailsPageProps = {
  params: {
    id: string;
  };
};

export default async function AdminDocumentDetailsPage({ params }: AdminDocumentDetailsPageProps) {
  const { i18n } = await setupI18nSSR();

  const document = await getEntireDocument({ id: Number(params.id) });

  return (
    <div>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-x-4">
          <h1 className="text-2xl font-semibold">{document.title}</h1>
          <DocumentStatus status={document.status} />
        </div>

        {document.deletedAt && (
          <Badge size="large" variant="destructive">
            <Trans>Deleted</Trans>
          </Badge>
        )}
      </div>

      <div className="text-muted-foreground mt-4 text-sm">
        <div>
          <Trans>Created on</Trans>: {i18n.date(document.createdAt, DateTime.DATETIME_MED)}
        </div>

        <div>
          <Trans>Last updated at</Trans>: {i18n.date(document.updatedAt, DateTime.DATETIME_MED)}
        </div>
      </div>

      <hr className="my-4" />

      <h2 className="text-lg font-semibold">
        <Trans>Admin Actions</Trans>
      </h2>

      <AdminActions className="mt-2" document={document} recipients={document.Recipient} />

      <hr className="my-4" />
      <h2 className="text-lg font-semibold">
        <Trans>Recipients</Trans>
      </h2>

      <div className="mt-4">
        <Accordion type="multiple" className="space-y-4">
          {document.Recipient.map((recipient) => (
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
                </div>
              </AccordionTrigger>

              <AccordionContent className="border-t px-4 pt-4">
                <RecipientItem recipient={recipient} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <hr className="my-4" />

      {document && <SuperDeleteDocumentDialog document={document} />}
    </div>
  );
}
