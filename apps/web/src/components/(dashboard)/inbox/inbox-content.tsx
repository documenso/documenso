import { TemplateDocumentCompleted } from '@documenso/email/template-components/template-document-completed';
import { TemplateDocumentInvite } from '@documenso/email/template-components/template-document-invite';
import { DocumentWithRecipientAndSender } from '@documenso/prisma/types/document';
import { cn } from '@documenso/ui/lib/utils';

import { formatInboxDate } from './inbox.utils';

export type InboxContentProps = {
  document: DocumentWithRecipientAndSender;
};

export default function InboxContent({ document }: InboxContentProps) {
  const inboxDocumentStatusIndicator = (
    <span
      className={cn(
        'ml-auto inline-flex items-center gap-x-1.5 rounded-md px-2 py-1 text-xs font-medium',
        {
          'bg-green-100 text-green-700': document.recipient.signingStatus === 'SIGNED',
          'bg-yellow-100 text-yellow-800': document.recipient.signingStatus === 'NOT_SIGNED',
        },
      )}
    >
      <div
        className={cn([
          'h-1.5 w-1.5 rounded-full',
          {
            'bg-green-500': document.recipient.signingStatus === 'SIGNED',
            'bg-yellow-500': document.recipient.signingStatus === 'NOT_SIGNED',
          },
        ])}
      ></div>

      {document.recipient.signingStatus === 'SIGNED' ? 'Signed' : 'Pending'}
    </span>
  );

  return (
    <div className="h-full">
      <div className="hidden h-14 w-full flex-row items-center border-b px-4 sm:flex">
        <div>
          <h2 className="text-sm font-semibold">{document.subject}</h2>
          <p className="text-xs">
            {document.sender.name} <span className="">&lt;{document.sender.email}&gt;</span>
          </p>
        </div>

        <div className="ml-auto flex flex-row items-center">
          {/* Todo: This needs to be updated to when the document was sent to the recipient when that value is available. */}
          <p className="mx-2 text-xs">{formatInboxDate(document.created)}</p>

          {inboxDocumentStatusIndicator}
        </div>
      </div>

      <div className="flex flex-row justify-end px-4 pt-4 sm:hidden">
        {inboxDocumentStatusIndicator}
      </div>

      {/* Todo: get correct URLs */}
      <div className="mx-auto mb-6 mt-0 w-full max-w-xl sm:mb-16 sm:mt-14 sm:p-4">
        {document.recipient.signingStatus === 'NOT_SIGNED' && (
          <TemplateDocumentInvite
            inviterName={document.sender.name ?? document.sender.email}
            inviterEmail={document.sender.email}
            documentName={document.title}
            signDocumentLink={'Todo'}
            assetBaseUrl={location.origin}
          />
        )}

        {document.recipient.signingStatus === 'SIGNED' && (
          <TemplateDocumentCompleted
            downloadLink={'Todo'}
            reviewLink={'Todo'}
            documentName={document.title}
            assetBaseUrl={location.origin}
          />
        )}
      </div>
    </div>
  );
}
