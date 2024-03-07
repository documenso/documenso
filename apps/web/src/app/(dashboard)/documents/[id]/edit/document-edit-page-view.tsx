import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ChevronLeft, Users2 } from 'lucide-react';

import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getFieldsForDocument } from '@documenso/lib/server-only/field/get-fields-for-document';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';
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

  const document = await getDocumentById({
    id: documentId,
    userId: user.id,
    teamId: team?.id,
  }).catch(() => null);

  if (!document || !document.documentData) {
    redirect(documentRootPath);
  }

  if (document.status === InternalDocumentStatus.COMPLETED) {
    redirect(`${documentRootPath}/${documentId}`);
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
      userId: user.id,
      teamId: team?.id,
    }),
    getFieldsForDocument({
      documentId,
      userId: user.id,
    }),
  ]);

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

            <StackAvatarsWithTooltip recipients={recipients} position="bottom">
              <span>{recipients.length} Recipient(s)</span>
            </StackAvatarsWithTooltip>
          </div>
        )}
      </div>

      <EditDocumentForm
        className="mt-8"
        document={document}
        user={user}
        documentMeta={documentMeta}
        recipients={recipients}
        fields={fields}
        documentData={documentData}
        documentRootPath={documentRootPath}
      />
    </div>
  );
};
