import { lazy } from 'react';

import { msg } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { DocumentStatus } from '@prisma/client';
import { ChevronLeft, Users2 } from 'lucide-react';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { EnvelopeRenderProvider } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import {
  DocumentReadOnlyFields,
  mapFieldsWithRecipients,
} from '@documenso/ui/components/document/document-read-only-fields';
import PDFViewerKonvaLazy from '@documenso/ui/components/pdf-viewer/pdf-viewer-konva-lazy';
import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { PDFViewerLazy } from '@documenso/ui/primitives/pdf-viewer/lazy';
import { Spinner } from '@documenso/ui/primitives/spinner';

import { DocumentPageViewButton } from '~/components/general/document/document-page-view-button';
import { DocumentPageViewDropdown } from '~/components/general/document/document-page-view-dropdown';
import { DocumentPageViewInformation } from '~/components/general/document/document-page-view-information';
import { DocumentPageViewRecentActivity } from '~/components/general/document/document-page-view-recent-activity';
import { DocumentPageViewRecipients } from '~/components/general/document/document-page-view-recipients';
import { DocumentRecipientLinkCopyDialog } from '~/components/general/document/document-recipient-link-copy-dialog';
import {
  DocumentStatus as DocumentStatusComponent,
  FRIENDLY_STATUS_MAP,
} from '~/components/general/document/document-status';
import { EnvelopeRendererFileSelector } from '~/components/general/envelope-editor/envelope-file-selector';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { StackAvatarsWithTooltip } from '~/components/general/stack-avatars-with-tooltip';
import { useCurrentTeam } from '~/providers/team';

import type { Route } from './+types/documents.$id._index';

const EnvelopeGenericPageRenderer = lazy(
  async () => import('~/components/general/envelope-editor/envelope-generic-page-renderer'),
);

export default function DocumentPage({ params }: Route.ComponentProps) {
  const { t } = useLingui();
  const { user } = useSession();

  const team = useCurrentTeam();

  const {
    data: envelope,
    isLoading: isLoadingEnvelope,
    isError: isErrorEnvelope,
  } = trpc.envelope.get.useQuery({
    envelopeId: params.id,
  });

  if (isLoadingEnvelope) {
    return (
      <div className="flex w-screen flex-col items-center justify-center gap-2 py-64 text-foreground">
        <Spinner />
        <Trans>Loading</Trans>
      </div>
    );
  }

  if (isErrorEnvelope || !envelope) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Not found`,
            subHeading: msg`404 Not found`,
            message: msg`The document you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/t/${team.url}/documents`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
      />
    );
  }

  const documentRootPath = formatDocumentsPath(team.url);

  const isMultiEnvelopeItem = envelope.envelopeItems.length > 1 && envelope.internalVersion === 2;

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      {envelope.status === DocumentStatus.PENDING && (
        <DocumentRecipientLinkCopyDialog recipients={envelope.recipients} />
      )}

      <Link to={documentRootPath} className="flex items-center text-[#7AC455] hover:opacity-80">
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        <Trans>Documents</Trans>
      </Link>

      <div className="flex flex-row justify-between truncate">
        <div>
          <h1
            className="mt-4 block max-w-[20rem] truncate text-2xl font-semibold md:max-w-[30rem] md:text-3xl"
            title={envelope.title}
          >
            {envelope.title}
          </h1>

          <div className="mt-2.5 flex items-center gap-x-6">
            <DocumentStatusComponent
              inheritColor
              status={envelope.status}
              className="text-muted-foreground"
            />

            {envelope.recipients.length > 0 && (
              <div className="flex items-center text-muted-foreground">
                <Users2 className="mr-2 h-5 w-5" />

                <StackAvatarsWithTooltip
                  recipients={envelope.recipients}
                  documentStatus={envelope.status}
                  position="bottom"
                >
                  <span>
                    <Plural
                      value={envelope.recipients.length}
                      one="# Recipient"
                      other="# Recipients"
                    />
                  </span>
                </StackAvatarsWithTooltip>
              </div>
            )}

            {envelope.deletedAt && (
              <Badge variant="destructive">
                <Trans>Document deleted</Trans>
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid w-full grid-cols-12 gap-8">
        {envelope.internalVersion === 2 ? (
          <div className="relative col-span-12 lg:col-span-6 xl:col-span-7">
            <EnvelopeRenderProvider
              envelope={envelope}
              token={undefined}
              fields={envelope.fields}
              recipients={envelope.recipients}
              overrideSettings={{
                showRecipientSigningStatus: true,
                showRecipientTooltip: true,
              }}
            >
              {isMultiEnvelopeItem && (
                <EnvelopeRendererFileSelector fields={envelope.fields} className="mb-4 p-0" />
              )}

              <Card className="rounded-xl before:rounded-xl" gradient>
                <CardContent className="p-2">
                  <PDFViewerKonvaLazy
                    renderer="preview"
                    customPageRenderer={EnvelopeGenericPageRenderer}
                  />
                </CardContent>
              </Card>
            </EnvelopeRenderProvider>
          </div>
        ) : (
          <Card
            className="relative col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
            gradient
          >
            <CardContent className="p-2">
              {envelope.status !== DocumentStatus.COMPLETED && (
                <DocumentReadOnlyFields
                  fields={mapFieldsWithRecipients(envelope.fields, envelope.recipients)}
                  documentMeta={envelope.documentMeta || undefined}
                  showRecipientTooltip={true}
                  showRecipientColors={true}
                  recipientIds={envelope.recipients.map((recipient) => recipient.id)}
                />
              )}

              <PDFViewerLazy
                envelopeItem={envelope.envelopeItems[0]}
                token={undefined}
                key={envelope.envelopeItems[0].id}
                version="signed"
              />
            </CardContent>
          </Card>
        )}

        <div
          className={cn('col-span-12 lg:col-span-6 xl:col-span-5', isMultiEnvelopeItem && 'mt-20')}
        >
          <div className="space-y-6">
            <section className="flex flex-col rounded-xl border border-border bg-widget pb-4 pt-6">
              <div className="flex flex-row items-center justify-between px-4">
                <h3 className="text-2xl font-semibold text-foreground">
                  {t(FRIENDLY_STATUS_MAP[envelope.status].labelExtended)}
                </h3>

                <DocumentPageViewDropdown envelope={envelope} />
              </div>

              <p className="mt-2 px-4 text-sm text-muted-foreground">
                {match(envelope.status)
                  .with(DocumentStatus.COMPLETED, () => (
                    <Trans>This document has been signed by all recipients</Trans>
                  ))
                  .with(DocumentStatus.REJECTED, () => (
                    <Trans>This document has been rejected by a recipient</Trans>
                  ))
                  .with(DocumentStatus.DRAFT, () => (
                    <Trans>This document is currently a draft and has not been sent</Trans>
                  ))
                  .with(DocumentStatus.PENDING, () => {
                    const pendingRecipients = envelope.recipients.filter(
                      (recipient) => recipient.signingStatus === 'NOT_SIGNED',
                    );

                    return (
                      <Plural
                        value={pendingRecipients.length}
                        one="Waiting on 1 recipient"
                        other="Waiting on # recipients"
                      />
                    );
                  })
                  .exhaustive()}
              </p>

              <div className="mt-4 border-t px-4 pt-4">
                <DocumentPageViewButton envelope={envelope} />
              </div>
            </section>

            {/* Document information section. */}
            <DocumentPageViewInformation envelope={envelope} userId={user.id} />

            {/* Recipients section. */}
            <DocumentPageViewRecipients envelope={envelope} documentRootPath={documentRootPath} />

            {/* Recent activity section. */}
            <DocumentPageViewRecentActivity
              documentId={mapSecondaryIdToDocumentId(envelope.secondaryId)}
              userId={user.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
