import { notFound } from 'next/navigation';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getDocumentByAccessToken } from '@documenso/lib/server-only/document/get-document-by-access-token';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';

import { DocumentDownloadButton } from './document-download-button';

export type DocumentAccessPageProps = {
  params: {
    token?: string;
  };
};

export default async function DocumentAccessPage({ params: { token } }: DocumentAccessPageProps) {
  await setupI18nSSR();

  if (!token) {
    return notFound();
  }

  const { document } = await getDocumentByAccessToken({ token });
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
            <LazyPDFViewer
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
              <DocumentDownloadButton document={document} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
