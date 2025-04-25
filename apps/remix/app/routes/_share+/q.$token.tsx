import { redirect } from 'react-router';

import { getDocumentByAccessToken } from '@documenso/lib/server-only/document/get-document-by-access-token';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import PDFViewer from '@documenso/ui/primitives/pdf-viewer';

import { ShareDocumentDownloadButton } from '~/components/general/share-document-download-button';

import type { Route } from './+types/q.$token';

export async function loader({ params }: Route.LoaderArgs) {
  const { token } = params;

  if (!token) {
    throw redirect('/');
  }

  const { document } = await getDocumentByAccessToken({ token });

  if (!document) {
    throw new Response('Not Found', { status: 404 });
  }

  return {
    document,
  };
}

export default function PublicProfilePage({ loaderData }: Route.ComponentProps) {
  const { document } = loaderData;
  const { documentData, documentMeta } = document;

  return (
    <div className="mx-auto w-full max-w-screen-xl md:px-8">
      <h1
        className="mt-4 block max-w-[20rem] truncate text-2xl font-semibold md:max-w-[30rem] md:text-3xl"
        title={document.title}
      >
        {document.title}
      </h1>

      <div className="mt-8 grid grid-cols-12 gap-y-8 lg:gap-x-8 lg:gap-y-0">
        <Card
          className="col-span-12 rounded-xl before:rounded-xl lg:col-span-7 xl:col-span-8"
          gradient
        >
          <CardContent className="p-2">
            <PDFViewer
              key={documentData.id}
              documentData={documentData}
              document={document}
              password={documentMeta?.password}
            />
          </CardContent>
        </Card>

        <div className="col-span-12 lg:col-span-5 xl:col-span-4">
          <section className="border-border bg-widget flex flex-col rounded-xl border pb-4 pt-6">
            <div className="flex flex-row items-center justify-between px-4">
              <h3 className="text-foreground text-2xl font-semibold">Download document</h3>
            </div>

            <p className="text-muted-foreground mt-2 px-4 text-sm">
              Download the document as a PDF file.
            </p>

            <div className="mt-4 border-t px-4 pt-4">
              <ShareDocumentDownloadButton document={document} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
