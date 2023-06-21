import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ChevronLeft } from 'lucide-react';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getFieldsForDocument } from '@documenso/lib/server-only/field/get-fields-for-document';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';

import { EditDocumentForm } from '~/components/forms/edit-document';

export type DocumentPageProps = {
  params: {
    id: string;
  };
};

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = params;

  const documentId = Number(id);

  if (!documentId || Number.isNaN(documentId)) {
    redirect('/documents');
  }

  const session = await getRequiredServerComponentSession();

  const document = await getDocumentById({
    id: documentId,
    userId: session.id,
  }).catch(() => null);

  if (!document) {
    redirect('/documents');
  }

  const [recipients, fields] = await Promise.all([
    await getRecipientsForDocument({
      documentId,
      userId: session.id,
    }),
    await getFieldsForDocument({
      documentId,
      userId: session.id,
    }),
  ]);

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      <Link href="/documents" className="flex items-center text-[#7AC455] hover:opacity-80">
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        Documents
      </Link>

      <h1
        className="mt-4 max-w-xs truncate text-2xl font-semibold md:text-3xl"
        title={document.title}
      >
        {document.title}
      </h1>

      <EditDocumentForm
        className="mt-8"
        document={document}
        user={session}
        recipients={recipients}
        fields={fields}
      />
    </div>
  );
}
