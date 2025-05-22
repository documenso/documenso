import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { DocumentStatus, TeamMemberRole } from '@prisma/client';
import { ChevronLeft, Clock9, Users2 } from 'lucide-react';
import { Link, redirect } from 'react-router';
import { match } from 'ts-pattern';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { getDocumentWithDetailsById } from '@documenso/lib/server-only/document/get-document-with-details-by-id';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { DocumentVisibility } from '@documenso/lib/types/document-visibility';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { DocumentReadOnlyFields } from '@documenso/ui/components/document/document-read-only-fields';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { PDFViewer } from '@documenso/ui/primitives/pdf-viewer';

import { DocumentHistorySheet } from '~/components/general/document/document-history-sheet';
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
import { StackAvatarsWithTooltip } from '~/components/general/stack-avatars-with-tooltip';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/documents.$id._index';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  const teamUrl = params.teamUrl;

  if (!teamUrl) {
    throw new Response('Not Found', { status: 404 });
  }

  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  const { id } = params;

  const documentId = Number(id);

  const documentRootPath = formatDocumentsPath(team?.url);

  if (!documentId || Number.isNaN(documentId)) {
    throw redirect(documentRootPath);
  }

  const document = await getDocumentWithDetailsById({
    documentId,
    userId: user.id,
    teamId: team.id,
  }).catch(() => null);

  // Todo: 401 or 404 page.
  if (!document) {
    throw redirect(documentRootPath);
  }

  if (document?.folderId) {
    throw redirect(documentRootPath);
  }

  const documentVisibility = document?.visibility;
  const currentTeamMemberRole = team.currentTeamRole;
  const isRecipient = document?.recipients.find((recipient) => recipient.email === user.email);
  let canAccessDocument = true;

  if (!isRecipient && document?.userId !== user.id) {
    canAccessDocument = match([documentVisibility, currentTeamMemberRole])
      .with([DocumentVisibility.EVERYONE, TeamMemberRole.ADMIN], () => true)
      .with([DocumentVisibility.EVERYONE, TeamMemberRole.MANAGER], () => true)
      .with([DocumentVisibility.EVERYONE, TeamMemberRole.MEMBER], () => true)
      .with([DocumentVisibility.MANAGER_AND_ABOVE, TeamMemberRole.ADMIN], () => true)
      .with([DocumentVisibility.MANAGER_AND_ABOVE, TeamMemberRole.MANAGER], () => true)
      .with([DocumentVisibility.ADMIN, TeamMemberRole.ADMIN], () => true)
      .otherwise(() => false);
  }

  if (!document || !document.documentData || !canAccessDocument) {
    throw redirect(documentRootPath);
  }

  return superLoaderJson({
    document,
    documentRootPath,
  });
}

export default function DocumentPage() {
  const loaderData = useSuperLoaderData<typeof loader>();

  const { _ } = useLingui();
  const { user } = useSession();

  const { document, documentRootPath } = loaderData;

  const { recipients, documentData, documentMeta } = document;

  // This was a feature flag. Leave to false since it's not ready.
  const isDocumentHistoryEnabled = false;

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      {document.status === DocumentStatus.PENDING && (
        <DocumentRecipientLinkCopyDialog recipients={recipients} />
      )}

      <Link to={documentRootPath} className="flex items-center text-[#7AC455] hover:opacity-80">
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        <Trans>Documents</Trans>
      </Link>

      <div className="flex flex-row justify-between truncate">
        <div>
          <h1
            className="mt-4 block max-w-[20rem] truncate text-2xl font-semibold md:max-w-[30rem] md:text-3xl"
            title={document.title}
          >
            {document.title}
          </h1>

          <div className="mt-2.5 flex items-center gap-x-6">
            <DocumentStatusComponent
              inheritColor
              status={document.status}
              className="text-muted-foreground"
            />

            {recipients.length > 0 && (
              <div className="text-muted-foreground flex items-center">
                <Users2 className="mr-2 h-5 w-5" />

                <StackAvatarsWithTooltip
                  recipients={recipients}
                  documentStatus={document.status}
                  position="bottom"
                >
                  <span>
                    <Trans>{recipients.length} Recipient(s)</Trans>
                  </span>
                </StackAvatarsWithTooltip>
              </div>
            )}

            {document.deletedAt && (
              <Badge variant="destructive">
                <Trans>Document deleted</Trans>
              </Badge>
            )}
          </div>
        </div>

        {isDocumentHistoryEnabled && (
          <div className="self-end">
            <DocumentHistorySheet documentId={document.id} userId={user.id}>
              <Button variant="outline">
                <Clock9 className="mr-1.5 h-4 w-4" />
                <Trans>Document history</Trans>
              </Button>
            </DocumentHistorySheet>
          </div>
        )}
      </div>

      <div className="mt-6 grid w-full grid-cols-12 gap-8">
        <Card
          className="relative col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
          gradient
        >
          <CardContent className="p-2">
            <PDFViewer document={document} key={documentData.id} documentData={documentData} />
          </CardContent>
        </Card>

        {document.status !== DocumentStatus.COMPLETED && (
          <DocumentReadOnlyFields
            fields={document.fields}
            documentMeta={documentMeta || undefined}
            showRecipientTooltip={true}
            showRecipientColors={true}
            recipientIds={recipients.map((recipient) => recipient.id)}
          />
        )}

        <div className="col-span-12 lg:col-span-6 xl:col-span-5">
          <div className="space-y-6">
            <section className="border-border bg-widget flex flex-col rounded-xl border pb-4 pt-6">
              <div className="flex flex-row items-center justify-between px-4">
                <h3 className="text-foreground text-2xl font-semibold">
                  {_(FRIENDLY_STATUS_MAP[document.status].labelExtended)}
                </h3>

                <DocumentPageViewDropdown document={document} />
              </div>

              <p className="text-muted-foreground mt-2 px-4 text-sm">
                {match(document.status)
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
                    const pendingRecipients = recipients.filter(
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
                <DocumentPageViewButton document={document} />
              </div>
            </section>

            {/* Document information section. */}
            <DocumentPageViewInformation document={document} userId={user.id} />

            {/* Recipients section. */}
            <DocumentPageViewRecipients document={document} documentRootPath={documentRootPath} />

            {/* Recent activity section. */}
            <DocumentPageViewRecentActivity documentId={document.id} userId={user.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
