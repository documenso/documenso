import React from 'react';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { findTemplates } from '@documenso/lib/server-only/template/find-templates';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import type { Team } from '@documenso/prisma/client';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';

import { TemplatesDataTable } from './data-table-templates';
import { EmptyTemplateState } from './empty-state';
import { NewTemplateDialog } from './new-template-dialog';

export type TemplatesPageViewProps = {
  searchParams?: {
    page?: number;
    perPage?: number;
  };
  team?: Team;
};

export const TemplatesPageView = async ({ searchParams = {}, team }: TemplatesPageViewProps) => {
  const { user } = await getRequiredServerComponentSession();
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 10;

  const documentRootPath = formatDocumentsPath(team?.url);
  const templateRootPath = formatTemplatesPath(team?.url);

  const { templates, totalPages } = await findTemplates({
    userId: user.id,
    teamId: team?.id,
    page: page,
    perPage: perPage,
  });

  return (
    <div className="mx-auto max-w-screen-xl px-4 md:px-8">
      <div className="flex items-baseline justify-between">
        <div className="flex flex-row items-center">
          {team && (
            <Avatar className="dark:border-border mr-3 h-12 w-12 border-2 border-solid border-white">
              <AvatarFallback className="text-xs text-gray-400">
                {team.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          )}

          <h1 className="truncate text-2xl font-semibold md:text-3xl">Templates</h1>
        </div>

        <div>
          <NewTemplateDialog templateRootPath={templateRootPath} teamId={team?.id} />
        </div>
      </div>

      <div className="relative mt-5">
        {templates.length > 0 ? (
          <TemplatesDataTable
            templates={templates}
            page={page}
            perPage={perPage}
            totalPages={totalPages}
            documentRootPath={documentRootPath}
            templateRootPath={templateRootPath}
            teamId={team?.id}
          />
        ) : (
          <EmptyTemplateState />
        )}
      </div>
    </div>
  );
};
