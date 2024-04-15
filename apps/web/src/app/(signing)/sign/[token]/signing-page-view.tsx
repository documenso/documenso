import { match } from 'ts-pattern';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import type { DocumentAndSender } from '@documenso/lib/server-only/document/get-document-by-token';
import type { Field, Recipient } from '@documenso/prisma/client';
import { FieldType, RecipientRole } from '@documenso/prisma/client';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';

import { truncateTitle } from '~/helpers/truncate-title';

import { DateField } from './date-field';
import { EmailField } from './email-field';
import { SigningForm } from './form';
import { NameField } from './name-field';
import { SignatureField } from './signature-field';
import { TextField } from './text-field';

export type SigningPageViewProps = {
  document: DocumentAndSender;
  recipient: Recipient;
  fields: Field[];
};

export const SigningPageView = ({ document, recipient, fields }: SigningPageViewProps) => {
  const truncatedTitle = truncateTitle(document.title);

  const { documentData, documentMeta } = document;

  return (
    <div className="mx-auto w-full max-w-screen-xl">
      <h1 className="mt-4 truncate text-2xl font-semibold md:text-3xl" title={document.title}>
        {truncatedTitle}
      </h1>

      <div className="mt-2.5 flex items-center gap-x-6">
        <p className="text-muted-foreground">
          {document.User.name} ({document.User.email}) has invited you to{' '}
          {recipient.role === RecipientRole.VIEWER && 'view'}
          {recipient.role === RecipientRole.SIGNER && 'sign'}
          {recipient.role === RecipientRole.APPROVER && 'approve'} this document.
        </p>
      </div>

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
          <SigningForm
            document={document}
            recipient={recipient}
            fields={fields}
            redirectUrl={documentMeta?.redirectUrl}
          />
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
              <DateField
                key={field.id}
                field={field}
                recipient={recipient}
                dateFormat={documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT}
                timezone={documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE}
              />
            ))
            .with(FieldType.EMAIL, () => (
              <EmailField key={field.id} field={field} recipient={recipient} />
            ))
            .with(FieldType.TEXT, () => (
              <TextField key={field.id} field={field} recipient={recipient} />
            ))
            .otherwise(() => null),
        )}
      </ElementVisible>
    </div>
  );
};
