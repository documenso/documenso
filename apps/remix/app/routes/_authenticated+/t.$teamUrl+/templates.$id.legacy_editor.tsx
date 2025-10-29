import { Trans } from '@lingui/react/macro';
import { ChevronLeft } from 'lucide-react';
import { Link, redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { formatTemplatesPath } from '@documenso/lib/utils/teams';

import { TemplateDirectLinkDialog } from '~/components/dialogs/template-direct-link-dialog';
import { DocumentAttachmentsPopover } from '~/components/general/document/document-attachments-popover';
import { LegacyFieldWarningPopover } from '~/components/general/legacy-field-warning-popover';
import { TemplateDirectLinkBadge } from '~/components/general/template/template-direct-link-badge';
import { TemplateEditForm } from '~/components/general/template/template-edit-form';
import { TemplateType } from '~/components/general/template/template-type';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/templates.$id.edit';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { id, teamUrl } = params;

  if (!id || !teamUrl) {
    throw new Response('Not Found', { status: 404 });
  }

  const { user } = await getSession(request);

  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  const templateRootPath = formatTemplatesPath(team.url);

  const template = await getTemplateById({
    id: {
      type: 'envelopeId',
      id,
    },
    userId: user.id,
    teamId: team.id,
  }).catch(() => null);

  if (!template || !template.templateDocumentData) {
    throw redirect(templateRootPath);
  }

  return superLoaderJson({
    template: {
      ...template,
      folder: null,
    },
    templateRootPath,
  });
}

export default function TemplateEditPage() {
  const { template, templateRootPath } = useSuperLoaderData<typeof loader>();

  return (
    <div className="mx-auto -mt-4 max-w-screen-xl px-4 md:px-8">
      <div className="flex flex-col justify-between sm:flex-row">
        <div>
          <Link
            to={`${templateRootPath}/${template.envelopeId}`}
            className="flex items-center text-[#7AC455] hover:opacity-80"
          >
            <ChevronLeft className="mr-2 inline-block h-5 w-5" />
            <Trans>Template</Trans>
          </Link>

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

        <div className="mt-2 flex items-center gap-2 sm:mt-0 sm:self-end">
          <DocumentAttachmentsPopover envelopeId={template.envelopeId} />

          <TemplateDirectLinkDialog
            templateId={template.id}
            directLink={template.directLink}
            recipients={template.recipients}
          />

          {template.useLegacyFieldInsertion && (
            <div>
              <LegacyFieldWarningPopover type="template" templateId={template.id} />
            </div>
          )}
        </div>
      </div>

      <TemplateEditForm
        className="mt-6"
        initialTemplate={template}
        templateRootPath={templateRootPath}
      />
    </div>
  );
}
