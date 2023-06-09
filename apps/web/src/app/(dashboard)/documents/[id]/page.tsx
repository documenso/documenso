import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ChevronLeft } from 'lucide-react';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { Button } from '@documenso/ui/primitives/button';

import { LoadablePDFCard } from './loadable-pdf-card';

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

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      <Link href="/documents" className="flex items-center text-[#7AC455] hover:opacity-80">
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        Dashboard
      </Link>

      <h1
        className="mt-4 max-w-xs truncate text-2xl font-semibold md:text-3xl"
        title={document.title}
      >
        Document.pdf
      </h1>

      <div className="mt-8 grid w-full grid-cols-12 gap-x-8">
        <LoadablePDFCard
          className="col-span-7 rounded-xl before:rounded-xl"
          document={document.document}
        />

        <div className="relative col-span-5">
          <div className="sticky top-20 flex max-h-screen min-h-[calc(100vh-6rem)] flex-col rounded-xl border bg-[hsl(var(--widget))] px-4 py-6">
            <h3 className="text-2xl font-semibold">Add Signers</h3>

            <p className="mt-2 text-sm text-black/30">Add the people who will sign the document.</p>

            <hr className="mb-8 mt-4" />

            <div className="flex-1"></div>

            <div className="">
              <p className="text-sm text-black/30">Add Signers (1/3)</p>

              <div className="relative mt-4 h-[2px] rounded-md bg-slate-300">
                <div className="bg-primary absolute inset-y-0 left-0 w-1/3" />
              </div>

              <div className="mt-4 flex gap-x-4">
                <Button
                  className="flex-1 bg-black/5 hover:bg-black/10"
                  size="lg"
                  variant="secondary"
                >
                  Go Back
                </Button>

                <Button className="flex-1" size="lg">
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
