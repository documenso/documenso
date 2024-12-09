import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Plural, Trans } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { ChevronLeft, Clock9, Users2 } from 'lucide-react';
import { match } from 'ts-pattern';

import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getServerComponentFlag } from '@documenso/lib/server-only/feature-flags/get-server-component-feature-flag';
import { getFieldsForDocument } from '@documenso/lib/server-only/field/get-fields-for-document';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';
import { DocumentVisibility } from '@documenso/lib/types/document-visibility';
import { symmetricDecrypt } from '@documenso/lib/universal/crypto';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { DocumentStatus } from '@documenso/prisma/client';
import type { Team, TeamEmail } from '@documenso/prisma/client';
import { TeamMemberRole } from '@documenso/prisma/client';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';

import { StackAvatarsWithTooltip } from '~/components/(dashboard)/avatar/stack-avatars-with-tooltip';
import { DocumentHistorySheet } from '~/components/document/document-history-sheet';
import { DocumentReadOnlyFields } from '~/components/document/document-read-only-fields';
import { DocumentRecipientLinkCopyDialog } from '~/components/document/document-recipient-link-copy-dialog';
import {
  DocumentStatus as DocumentStatusComponent,
  FRIENDLY_STATUS_MAP,
} from '~/components/formatter/document-status';

import { DocumentPageViewButton } from './document-page-view-button';
import { DocumentPageViewDropdown } from './document-page-view-dropdown';
import { DocumentPageViewInformation } from './document-page-view-information';
import { DocumentPageViewRecentActivity } from './document-page-view-recent-activity';
import { DocumentPageViewRecipients } from './document-page-view-recipients';

export type DocumentPageViewProps = {
  params: {
    id: string;
  };
  team?: Team & { teamEmail: TeamEmail | null } & { currentTeamMember: { role: TeamMemberRole } };
};

export const DocumentPageView = async ({ params, team }: DocumentPageViewProps) => {
  const { id } = params;
  const { _ } = useLingui();

  const documentId = Number(id);

  const documentRootPath = formatDocumentsPath(team?.url);

  if (!documentId || Number.isNaN(documentId)) {
    redirect(documentRootPath);
  }

  const { user } = await getRequiredServerComponentSession();

  const document = await getDocumentById({
    id: documentId,
    userId: user.id,
    teamId: team?.id,
  }).catch(() => null);

  if (document?.teamId && !team?.url) {
    redirect(documentRootPath);
  }

  const documentVisibility = document?.visibility;
  const currentTeamMemberRole = team?.currentTeamMember?.role;
  const isRecipient = document?.Recipient.find((recipient) => recipient.email === user.email);
  let canAccessDocument = true;

  if (team && !isRecipient && document?.userId !== user.id) {
    canAccessDocument = match([documentVisibility, currentTeamMemberRole])
      .with([DocumentVisibility.EVERYONE, TeamMemberRole.ADMIN], () => true)
      .with([DocumentVisibility.EVERYONE, TeamMemberRole.MANAGER], () => true)
      .with([DocumentVisibility.EVERYONE, TeamMemberRole.MEMBER], () => true)
      .with([DocumentVisibility.MANAGER_AND_ABOVE, TeamMemberRole.ADMIN], () => true)
      .with([DocumentVisibility.MANAGER_AND_ABOVE, TeamMemberRole.MANAGER], () => true)
      .with([DocumentVisibility.ADMIN, TeamMemberRole.ADMIN], () => true)
      .otherwise(() => false);
  }

  const isDocumentHistoryEnabled = await getServerComponentFlag(
    'app_document_page_view_history_sheet',
  );

  if (!document || !document.documentData || (team && !canAccessDocument)) {
    redirect(documentRootPath);
  }

  if (team && !canAccessDocument) {
    redirect(documentRootPath);
  }

  const { documentData, documentMeta } = document;

  if (documentMeta?.password) {
    const key = DOCUMENSO_ENCRYPTION_KEY;

    if (!key) {
      throw new Error('Missing DOCUMENSO_ENCRYPTION_KEY');
    }

    const securePassword = Buffer.from(
      symmetricDecrypt({
        key,
        data: documentMeta.password,
      }),
    ).toString('utf-8');

    documentMeta.password = securePassword;
  }

  const [recipients, fields] = await Promise.all([
    getRecipientsForDocument({
      documentId,
      teamId: team?.id,
      userId: user.id,
    }),
    getFieldsForDocument({
      documentId,
      userId: user.id,
    }),
  ]);

  const documentWithRecipients = {
    ...document,
    Recipient: recipients,
  };

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      {document.status === DocumentStatus.PENDING && (
        <DocumentRecipientLinkCopyDialog recipients={recipients} />
      )}

      <Link href={documentRootPath} className="flex items-center text-[#7AC455] hover:opacity-80">
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
            <LazyPDFViewer document={document} key={documentData.id} documentData={documentData} />
          </CardContent>
        </Card>

        {document.status === DocumentStatus.PENDING && (
          <DocumentReadOnlyFields fields={fields} documentMeta={documentMeta || undefined} />
        )}

        <div className="col-span-12 lg:col-span-6 xl:col-span-5">
          <div className="space-y-6">
            <section className="border-border bg-widget flex flex-col rounded-xl border pb-4 pt-6">
              <div className="flex flex-row items-center justify-between px-4">
                <h3 className="text-foreground text-2xl font-semibold">
                  {_(FRIENDLY_STATUS_MAP[document.status].labelExtended)}
                </h3>

                <DocumentPageViewDropdown document={documentWithRecipients} team={team} />
              </div>

              <p className="text-muted-foreground mt-2 px-4 text-sm">
                {match(document.status)
                  .with(DocumentStatus.COMPLETED, () => (
                    <Trans>This document has been signed by all recipients</Trans>
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
                <DocumentPageViewButton document={documentWithRecipients} team={team} />
              </div>
            </section>

            {/* Document information section. */}
            <DocumentPageViewInformation document={documentWithRecipients} userId={user.id} />

            {/* Recipients section. */}
            <DocumentPageViewRecipients
              document={documentWithRecipients}
              documentRootPath={documentRootPath}
            />

            {/* Recent activity section. */}
            <DocumentPageViewRecentActivity documentId={document.id} userId={user.id} />
          </div>
        </div>
      </div>
    </div>
  );
};
