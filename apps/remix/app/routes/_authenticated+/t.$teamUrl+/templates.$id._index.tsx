import { Trans } from '@lingui/react/macro';
import { DocumentSigningOrder, SigningStatus } from '@prisma/client';
import { ChevronLeft, LucideEdit } from 'lucide-react';
import { Link, redirect, useNavigate } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { DocumentReadOnlyFields } from '@documenso/ui/components/document/document-read-only-fields';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { PDFViewer } from '@documenso/ui/primitives/pdf-viewer';

import { TemplateBulkSendDialog } from '~/components/dialogs/template-bulk-send-dialog';
import { TemplateDirectLinkDialogWrapper } from '~/components/dialogs/template-direct-link-dialog-wrapper';
import { TemplateUseDialog } from '~/components/dialogs/template-use-dialog';
import { TemplateDirectLinkBadge } from '~/components/general/template/template-direct-link-badge';
import { TemplatePageViewDocumentsTable } from '~/components/general/template/template-page-view-documents-table';
import { TemplatePageViewInformation } from '~/components/general/template/template-page-view-information';
import { TemplatePageViewRecentActivity } from '~/components/general/template/template-page-view-recent-activity';
import { TemplatePageViewRecipients } from '~/components/general/template/template-page-view-recipients';
import { TemplateType } from '~/components/general/template/template-type';
import { TemplatesTableActionDropdown } from '~/components/tables/templates-table-action-dropdown';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/templates.$id._index';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  const team = await getTeamByUrl({ userId: user.id, teamUrl: params.teamUrl });

  const { id } = params;

  const templateId = Number(id);
  const templateRootPath = formatTemplatesPath(team.url);
  const documentRootPath = formatDocumentsPath(team.url);

  if (!templateId || Number.isNaN(templateId)) {
    throw redirect(templateRootPath);
  }

  const template = await getTemplateById({
    id: templateId,
    userId: user.id,
    teamId: team?.id,
  }).catch(() => null);

  if (!template || !template.templateDocumentData || (template?.teamId && !team.url)) {
    throw redirect(templateRootPath);
  }

  return superLoaderJson({
    user,
    team,
    template,
    templateRootPath,
    documentRootPath,
  });
}

export default function TemplatePage() {
  const { user, team, template, templateRootPath, documentRootPath } =
    useSuperLoaderData<typeof loader>();

  const { templateDocumentData, fields, recipients, templateMeta } = template;

  const navigate = useNavigate();

  // Remap to fit the DocumentReadOnlyFields component.
  const readOnlyFields = fields.map((field) => {
    const recipient = recipients.find((recipient) => recipient.id === field.recipientId) || {
      name: '',
      email: '',
      signingStatus: SigningStatus.NOT_SIGNED,
    };

    return {
      ...field,
      recipient,
      signature: null,
    };
  });

  const mockedDocumentMeta = templateMeta
    ? {
        ...templateMeta,
        signingOrder: templateMeta.signingOrder || DocumentSigningOrder.SEQUENTIAL,
        documentId: 0,
      }
    : undefined;

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      <Link to={templateRootPath} className="flex items-center text-[#7AC455] hover:opacity-80">
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        <Trans>Templates</Trans>
      </Link>

      <div className="flex flex-row justify-between truncate">
        <div>
          <h1
            className="mt-4 block max-w-[20rem] truncate text-2xl font-semibold md:max-w-[30rem] md:text-3xl"
            title={template.title}
          >
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

        <div className="mt-2 flex flex-row space-x-4 sm:mt-0 sm:self-end">
          <TemplateDirectLinkDialogWrapper template={template} />

          <TemplateBulkSendDialog templateId={template.id} recipients={template.recipients} />

          <Button className="w-full" asChild>
            <Link to={`${templateRootPath}/${template.id}/edit`}>
              <LucideEdit className="mr-1.5 h-3.5 w-3.5" />
              <Trans>Edit Template</Trans>
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid w-full grid-cols-12 gap-8">
        <Card
          className="relative col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
          gradient
        >
          <CardContent className="p-2">
            <PDFViewer document={template} key={template.id} documentData={templateDocumentData} />
          </CardContent>
        </Card>

        <DocumentReadOnlyFields
          fields={readOnlyFields}
          showFieldStatus={false}
          showRecipientTooltip={true}
          showRecipientColors={true}
          recipientIds={recipients.map((recipient) => recipient.id)}
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
                  <TemplatesTableActionDropdown
                    row={template}
                    teamId={team?.id}
                    templateRootPath={templateRootPath}
                    onDelete={async () => navigate(templateRootPath)}
                  />
                </div>
              </div>

              <p className="text-muted-foreground mt-2 px-4 text-sm">
                <Trans>Manage and view template</Trans>
              </p>

              <div className="mt-4 border-t px-4 pt-4">
                <TemplateUseDialog
                  templateId={template.id}
                  templateSigningOrder={template.templateMeta?.signingOrder}
                  recipients={template.recipients}
                  documentRootPath={documentRootPath}
                  trigger={
                    <Button className="w-full">
                      <Trans>Use</Trans>
                    </Button>
                  }
                />
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
        <h1 className="mb-4 text-2xl font-bold">
          <Trans>Documents created from template</Trans>
        </h1>

        <TemplatePageViewDocumentsTable templateId={template.id} />
      </div>
    </div>
  );
}
