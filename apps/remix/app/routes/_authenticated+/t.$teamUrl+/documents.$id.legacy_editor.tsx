import { Plural, Trans } from '@lingui/react/macro';
import { ChevronLeft, Users2 } from 'lucide-react';
import { Link, redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getDocumentWithDetailsById } from '@documenso/lib/server-only/document/get-document-with-details-by-id';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { logDocumentAccess } from '@documenso/lib/utils/logger';
import { canAccessTeamDocument, formatDocumentsPath } from '@documenso/lib/utils/teams';

import { DocumentAttachmentsPopover } from '~/components/general/document/document-attachments-popover';
import { DocumentEditForm } from '~/components/general/document/document-edit-form';
import { DocumentStatus } from '~/components/general/document/document-status';
import { LegacyFieldWarningPopover } from '~/components/general/legacy-field-warning-popover';
import { StackAvatarsWithTooltip } from '~/components/general/stack-avatars-with-tooltip';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/documents.$id.edit';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { id, teamUrl } = params;

  if (!id || !teamUrl) {
    throw new Response('Not Found', { status: 404 });
  }

  const { user } = await getSession(request);

  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  const documentRootPath = formatDocumentsPath(team.url);

  const document = await getDocumentWithDetailsById({
    id: {
      type: 'envelopeId',
      id,
    },
    userId: user.id,
    teamId: team.id,
  }).catch(() => null);

  if (!document) {
    throw new Response('Not Found', { status: 404 });
  }

  const documentVisibility = document.visibility;
  const currentTeamMemberRole = team.currentTeamRole;
  const isRecipient = document.recipients.find((recipient) => recipient.email === user.email);

  let canAccessDocument = true;

  if (!isRecipient && document.userId !== user.id) {
    canAccessDocument = canAccessTeamDocument(currentTeamMemberRole, documentVisibility);
  }

  if (!canAccessDocument) {
    throw new Response('Not Found', { status: 404 });
  }

  if (isDocumentCompleted(document.status)) {
    throw redirect(`${documentRootPath}/${id}`);
  }

  logDocumentAccess({
    request,
    documentId: document.id,
    userId: user.id,
  });

  return superLoaderJson({
    document: {
      ...document,
      folder: null,
    },
    documentRootPath,
  });
}

export default function DocumentEditPage() {
  const { document, documentRootPath } = useSuperLoaderData<typeof loader>();

  const { recipients } = document;

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      <Link to={documentRootPath} className="flex items-center text-[#7AC455] hover:opacity-80">
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        <Trans>Documents</Trans>
      </Link>

      <div className="mt-4 flex w-full items-end justify-between">
        <div className="flex-1">
          <h1
            className="block max-w-[20rem] truncate text-2xl font-semibold md:max-w-[30rem] md:text-3xl"
            title={document.title}
          >
            {document.title}
          </h1>

          <div className="mt-2.5 flex items-center gap-x-6">
            <DocumentStatus
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
                    <Plural one="1 Recipient" other="# Recipients" value={recipients.length} />
                  </span>
                </StackAvatarsWithTooltip>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-x-4">
          <DocumentAttachmentsPopover envelopeId={document.envelopeId} />

          {document.useLegacyFieldInsertion && (
            <LegacyFieldWarningPopover type="document" documentId={document.id} />
          )}
        </div>
      </div>

      <DocumentEditForm
        className="mt-6"
        initialDocument={document}
        documentRootPath={documentRootPath}
      />
    </div>
  );
}
