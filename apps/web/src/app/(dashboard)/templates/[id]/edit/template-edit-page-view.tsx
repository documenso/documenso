import React from 'react';

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Trans } from '@lingui/macro';
import { ChevronLeft } from 'lucide-react';

import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTemplateWithDetailsById } from '@documenso/lib/server-only/template/get-template-with-details-by-id';
import { formatTemplatesPath } from '@documenso/lib/utils/teams';
import type { Team } from '@documenso/prisma/client';

import { TemplateType } from '~/components/formatter/template-type';

import { TemplateDirectLinkBadge } from '../../template-direct-link-badge';
import { TemplateDirectLinkDialogWrapper } from '../template-direct-link-dialog-wrapper';
import { EditTemplateForm } from './edit-template';

export type TemplateEditPageViewProps = {
  params: {
    id: string;
  };
  team?: Team;
};

export const TemplateEditPageView = async ({ params, team }: TemplateEditPageViewProps) => {
  const { id } = params;

  const templateId = Number(id);
  const templateRootPath = formatTemplatesPath(team?.url);

  if (!templateId || Number.isNaN(templateId)) {
    redirect(templateRootPath);
  }

  const { user } = await getRequiredServerComponentSession();

  const template = await getTemplateWithDetailsById({
    id: templateId,
    userId: user.id,
  }).catch(() => null);

  if (!template || !template.templateDocumentData) {
    redirect(templateRootPath);
  }

  const isTemplateEnterprise = await isUserEnterprise({
    userId: user.id,
    teamId: team?.id,
  });

  return (
    <div className="mx-auto -mt-4 max-w-screen-xl px-4 md:px-8">
      <div className="flex flex-col justify-between sm:flex-row">
        <div>
          <Link
            href={`${templateRootPath}/${templateId}`}
            className="flex items-center text-[#7AC455] hover:opacity-80"
          >
            <ChevronLeft className="mr-2 inline-block h-5 w-5" />
            <Trans>Template</Trans>
          </Link>

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

      <EditTemplateForm
        className="mt-6"
        initialTemplate={template}
        templateRootPath={templateRootPath}
        isEnterprise={isTemplateEnterprise}
      />
    </div>
  );
};
