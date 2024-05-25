import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ChevronLeft, Users2 } from 'lucide-react';

import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getDocumentWithDetailsById } from '@documenso/lib/server-only/document/get-document-with-details-by-id';
import { symmetricDecrypt } from '@documenso/lib/universal/crypto';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import type { Team } from '@documenso/prisma/client';
import { DocumentStatus as InternalDocumentStatus } from '@documenso/prisma/client';

import { EditDocumentForm } from '~/app/(dashboard)/documents/[id]/edit-document';
import { StackAvatarsWithTooltip } from '~/components/(dashboard)/avatar/stack-avatars-with-tooltip';
import { DocumentStatus } from '~/components/formatter/document-status';

export type DocumentEditPageViewProps = {
  params: {
    id: string;
  };
  team?: Team;
};

export const DocumentEditPageView = async ({ params, team }: DocumentEditPageViewProps) => {
  const { id } = params;

  const documentId = Number(id);

  const documentRootPath = formatDocumentsPath(team?.url);

  if (!documentId || Number.isNaN(documentId)) {
    redirect(documentRootPath);
  }

  const { user } = await getRequiredServerComponentSession();

  const document = await getDocumentWithDetailsById({
    id: documentId,
    userId: user.id,
    teamId: team?.id,
  }).catch(() => null);

  if (!document) {
    redirect(documentRootPath);
  }

  if (document.status === InternalDocumentStatus.COMPLETED) {
    redirect(`${documentRootPath}/${documentId}`);
  }

  const { documentMeta, Recipient: recipients } = document;

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

  const isDocumentEnterprise = await isUserEnterprise({
    userId: user.id,
    teamId: team?.id,
  });

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      <Link href={documentRootPath} className="flex items-center text-[#7AC455] hover:opacity-80">
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        Documents
      </Link>

      <h1 className="mt-4 truncate text-2xl font-semibold md:text-3xl" title={document.title}>
        {document.title}
      </h1>

      <div className="mt-2.5 flex items-center gap-x-6">
        <DocumentStatus inheritColor status={document.status} className="text-muted-foreground" />

        {recipients.length > 0 && (
          <div className="text-muted-foreground flex items-center">
            <Users2 className="mr-2 h-5 w-5" />

            <StackAvatarsWithTooltip
              recipients={recipients}
              documentStatus={document.status}
              position="bottom"
            >
              <span>{recipients.length} Recipient(s)</span>
            </StackAvatarsWithTooltip>
          </div>
        )}
      </div>

      <EditDocumentForm
        className="mt-6"
        initialDocument={document}
        documentRootPath={documentRootPath}
        isDocumentEnterprise={isDocumentEnterprise}
      />
    </div>
  );
};
