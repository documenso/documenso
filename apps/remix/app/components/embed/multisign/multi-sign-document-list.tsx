import type { DocumentAndSender } from '@documenso/lib/server-only/document/get-document-by-token';
import type { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Progress } from '@documenso/ui/primitives/progress';
import { Trans } from '@lingui/react/macro';
import { ReadStatus, RecipientRole, SigningStatus } from '@prisma/client';
import { ArrowRight, EyeIcon, XCircle } from 'lucide-react';
import { match } from 'ts-pattern';

// Get the return type from getRecipientByToken
type RecipientWithFields = Awaited<ReturnType<typeof getRecipientByToken>>;

interface DocumentEnvelope {
  document: DocumentAndSender;
  recipient: RecipientWithFields;
}

interface MultiSignDocumentListProps {
  envelopes: DocumentEnvelope[];
  onDocumentSelect: (document: DocumentEnvelope['document']) => void;
}

export function MultiSignDocumentList({ envelopes, onDocumentSelect }: MultiSignDocumentListProps) {
  // Calculate progress
  const completedDocuments = envelopes.filter((envelope) => envelope.recipient.signingStatus === SigningStatus.SIGNED);
  const totalDocuments = envelopes.length;
  const progressPercentage = (completedDocuments.length / totalDocuments) * 100;

  // Find next document to sign (first one that's not signed and not rejected)
  const nextDocumentToSign = envelopes.find(
    (envelope) =>
      envelope.recipient.signingStatus !== SigningStatus.SIGNED &&
      envelope.recipient.signingStatus !== SigningStatus.REJECTED,
  );

  const allDocumentsCompleted = completedDocuments.length === totalDocuments;

  const hasAssistantOrCcRecipient = envelopes.some(
    (envelope) => envelope.recipient.role === RecipientRole.ASSISTANT || envelope.recipient.role === RecipientRole.CC,
  );

  function handleView(doc: DocumentEnvelope['document']) {
    onDocumentSelect(doc);
  }

  function handleNextDocument() {
    if (nextDocumentToSign) {
      onDocumentSelect(nextDocumentToSign.document);
    }
  }

  if (hasAssistantOrCcRecipient) {
    return (
      <div className="mx-auto mt-16 flex w-full max-w-lg flex-col md:mt-16 md:rounded-2xl md:border md:px-8 md:py-16 md:shadow-lg">
        <div className="flex items-center justify-center">
          <XCircle className="h-16 w-16 text-destructive md:h-24 md:w-24" strokeWidth={1.2} />
        </div>

        <h2 className="mt-12 font-bold text-xl md:text-2xl">
          <Trans>It looks like we ran into an issue!</Trans>
        </h2>

        <p className="mt-6 text-muted-foreground">
          <Trans>
            One of the documents in the current bundle has a signing role that is not compatible with the current
            signing experience.
          </Trans>
        </p>

        <p className="mt-2 text-muted-foreground">
          <Trans>Assistants and Copy roles are currently not compatible with the multi-sign experience.</Trans>
        </p>

        <p className="mt-2 text-muted-foreground">
          <Trans>Please contact the site owner for further assistance.</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg bg-background md:my-12 md:rounded-2xl md:border md:p-8 md:shadow-lg">
      <h2 className="mb-1 font-semibold text-foreground text-lg">
        <Trans>Sign Documents</Trans>
      </h2>

      <p className="text-muted-foreground text-sm">
        <Trans>
          You have been requested to sign the following documents. Review each document carefully and complete the
          signing process.
        </Trans>
      </p>

      {/* Progress Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-muted-foreground">
            <Trans>Progress</Trans>
          </span>
          <span className="text-muted-foreground">
            {completedDocuments.length} of {totalDocuments} completed
          </span>
        </div>

        <div className="mt-4">
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {envelopes.map((envelope) => (
          <div key={envelope.document.id} className="flex items-center gap-4 rounded-lg border border-border px-4 py-2">
            <span className="flex-1 truncate font-medium text-foreground text-sm">{envelope.document.title}</span>

            {match(envelope.recipient)
              .with({ signingStatus: SigningStatus.SIGNED }, () => (
                <Badge size="small" variant="default">
                  <Trans>Completed</Trans>
                </Badge>
              ))
              .with({ signingStatus: SigningStatus.REJECTED }, () => (
                <Badge size="small" variant="destructive">
                  <Trans>Rejected</Trans>
                </Badge>
              ))
              .with({ readStatus: ReadStatus.OPENED }, () => (
                <Badge size="small" variant="neutral">
                  <Trans>Viewed</Trans>
                </Badge>
              ))
              .otherwise(() => null)}

            <Button className="-mr-2" variant="outline" size="sm" onClick={() => handleView(envelope.document)}>
              <EyeIcon className="mr-1 h-4 w-4" />
              <Trans>View</Trans>
            </Button>
          </div>
        ))}
      </div>

      {/* Next Document Button */}
      {!allDocumentsCompleted && nextDocumentToSign && (
        <div className="mt-6">
          <Button onClick={handleNextDocument} className="w-full" size="lg">
            <Trans>View next document</Trans>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {allDocumentsCompleted && (
        <Alert className="mt-6 text-center">
          <AlertTitle>
            <Trans>All documents have been completed!</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>Thank you for completing the signing process.</Trans>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
