import { notFound } from 'next/navigation';

import { match } from 'ts-pattern';

import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { viewedDocument } from '@documenso/lib/server-only/document/viewed-document';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { FieldType } from '@documenso/prisma/client';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';

import { LazyPDFViewer } from '~/components/(dashboard)/pdf-viewer/lazy-pdf-viewer';
import { PDF_VIEWER_PAGE_SELECTOR } from '~/components/(dashboard)/pdf-viewer/types';

import { DateField } from './date-field';
import { SigningForm } from './form';
import { NameField } from './name-field';
import { SigningProvider } from './provider';
import { SignatureField } from './signature-field';

export type SigningPageProps = {
  params: {
    token?: string;
  };
};

export default async function SigningPage({ params: { token } }: SigningPageProps) {
  if (!token) {
    return notFound();
  }

  const [document, fields, recipient] = await Promise.all([
    getDocumentAndSenderByToken({
      token,
    }).catch(() => null),
    getFieldsForToken({ token }),
    getRecipientByToken({ token }),
    viewedDocument({ token }),
  ]);

  if (!document) {
    return notFound();
  }

  const documentUrl = `data:application/pdf;base64,${document.document}`;

  return (
    <SigningProvider email={recipient.email} fullName={recipient.name}>
      <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
        <h1 className="mt-4 truncate text-2xl font-semibold md:text-3xl" title={document.title}>
          {document.title}
        </h1>

        <div className="mt-2.5 flex items-center gap-x-6">
          <p className="text-muted-foreground">
            {document.User.name} ({document.User.email}) has invited you to sign this document.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-12 gap-8">
          <Card
            className="col-span-12 rounded-xl before:rounded-xl lg:col-span-7 xl:col-span-8"
            gradient
          >
            <CardContent className="p-2">
              <LazyPDFViewer document={documentUrl} />
            </CardContent>
          </Card>

          <div className="col-span-12 lg:col-span-5 xl:col-span-4">
            <SigningForm document={document} recipient={recipient} fields={fields} />
          </div>
        </div>

        <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
          {fields.map((field) =>
            match(field.type)
              .with(FieldType.SIGNATURE, () => (
                <SignatureField key={field.id} field={field} recipient={recipient} />
              ))
              .with(FieldType.NAME, () => (
                <NameField key={field.id} field={field} recipient={recipient} />
              ))
              .with(FieldType.DATE, () => (
                <DateField key={field.id} field={field} recipient={recipient} />
              ))
              .otherwise(() => null),
          )}
        </ElementVisible>
      </div>
    </SigningProvider>
  );
}
