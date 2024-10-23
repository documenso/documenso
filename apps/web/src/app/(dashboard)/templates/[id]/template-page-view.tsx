import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Trans } from '@lingui/macro';
import { ChevronLeft } from 'lucide-react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { DocumentSigningOrder, SigningStatus, type Team } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';

import { DocumentReadOnlyFields } from '~/components/document/document-read-only-fields';
import { TemplateType } from '~/components/formatter/template-type';

import { DataTableActionDropdown } from '../data-table-action-dropdown';
import { TemplateDirectLinkBadge } from '../template-direct-link-badge';
import { TemplateDirectLinkDialogWrapper } from './template-direct-link-dialog-wrapper';
import { TemplatePageViewDocumentsTable } from './template-page-view-documents-table';
import { TemplatePageViewInformation } from './template-page-view-information';
import { TemplatePageViewRecentActivity } from './template-page-view-recent-activity';
import { TemplatePageViewRecipients } from './template-page-view-recipients';

export type TemplatePageViewProps = {
  params: {
    id: string;
  };
  team?: Team;
};

export const TemplatePageView = async ({ params, team }: TemplatePageViewProps) => {
  setupI18nSSR();

  const { id } = params;

  const templateId = Number(id);
  const templateRootPath = formatTemplatesPath(team?.url);
  const documentRootPath = formatDocumentsPath(team?.url);

  if (!templateId || Number.isNaN(templateId)) {
    redirect(templateRootPath);
  }

  const { user } = await getRequiredServerComponentSession();

  const template = await getTemplateById({
    id: templateId,
    userId: user.id,
    teamId: team?.id,
  }).catch(() => null);

  if (!template || !template.templateDocumentData || (template?.teamId && !team?.url)) {
    redirect(templateRootPath);
  }

  const { templateDocumentData, Field, Recipient: recipients, templateMeta } = template;

  // Remap to fit the DocumentReadOnlyFields component.
  const fields = Field.map((field) => {
    const recipient = recipients.find((recipient) => recipient.id === field.recipientId) || {
      name: '',
      email: '',
      signingStatus: SigningStatus.NOT_SIGNED,
    };

    return {
      ...field,
      Recipient: recipient,
      Signature: null,
    };
  });

  const mockedDocumentMeta = templateMeta
    ? {
        ...templateMeta,
        documentId: 0,
        signingOrder: DocumentSigningOrder.SEQUENTIAL,
      }
    : undefined;

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      <Link href={templateRootPath} className="flex items-center text-[#7AC455] hover:opacity-80">
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        <Trans>Templates</Trans>
      </Link>

      <div className="flex flex-row justify-between truncate">
        <div>
          <h1 className="mt-4 truncate text-2xl font-semibold md:text-3xl" title={template.title}>
            {template.title}
          </h1>

          <div className="mt-2.5 flex items-center">
            <TemplateType inheritColor className="text-muted-foreground" type={template.type} />

            {template.directLink?.token && (
              <TemplateDirectLinkBadge
                className="ml-4"
                token={template.directLink.token}
                enabled={template.directLink.enabled}
              />
            )}
          </div>
        </div>

        <div className="mt-2 sm:mt-0 sm:self-end">
          <TemplateDirectLinkDialogWrapper template={template} />
        </div>
      </div>

      <div className="mt-6 grid w-full grid-cols-12 gap-8">
        <Card
          className="relative col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
          gradient
        >
          <CardContent className="p-2">
            <LazyPDFViewer
              document={template}
              key={template.id}
              documentData={templateDocumentData}
            />
          </CardContent>
        </Card>

        <DocumentReadOnlyFields
          fields={fields}
          showFieldStatus={false}
          documentMeta={mockedDocumentMeta}
        />

        <div className="col-span-12 lg:col-span-6 xl:col-span-5">
          <div className="space-y-6">
            <section className="border-border bg-widget flex flex-col rounded-xl border pb-4 pt-6">
              <div className="flex flex-row items-center justify-between px-4">
                <h3 className="text-foreground text-2xl font-semibold">
                  <Trans>Template</Trans>
                </h3>

                <div>
                  <DataTableActionDropdown
                    row={template}
                    teamId={team?.id}
                    templateRootPath={templateRootPath}
                  />
                </div>
              </div>

              <p className="text-muted-foreground mt-2 px-4 text-sm ">
                <Trans>Manage and view template</Trans>
              </p>

              <div className="mt-4 border-t px-4 pt-4">
                <Button className="w-full" asChild>
                  <Link href={`${templateRootPath}/${template.id}/edit`}>
                    <Trans>Edit</Trans>
                  </Link>
                </Button>
              </div>
            </section>

            {/* Template information section. */}
            <TemplatePageViewInformation template={template} userId={user.id} />

            {/* Recipients section. */}
            <TemplatePageViewRecipients template={template} templateRootPath={templateRootPath} />

            {/* Recent activity section. */}
            <TemplatePageViewRecentActivity
              documentRootPath={documentRootPath}
              templateId={template.id}
            />
          </div>
        </div>
      </div>

      <div className="mt-16" id="documents">
        <h1 className="mb-4 text-2xl font-bold">Documents created from template</h1>

        <TemplatePageViewDocumentsTable team={team} templateId={template.id} />
      </div>
    </div>
  );
};
