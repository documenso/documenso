import { useEffect } from 'react';

import { Trans } from '@lingui/react/macro';
import { Bird } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';

import { TemplateCreateDialog } from '~/components/dialogs/template-create-dialog';
import { TemplatesTable } from '~/components/tables/templates-table';
import { useOptionalCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Templates');
}

export default function TemplatesPage() {
  const [searchParams] = useSearchParams();

  const team = useOptionalCurrentTeam();

  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 10;

  const documentRootPath = formatDocumentsPath(team?.url);
  const templateRootPath = formatTemplatesPath(team?.url);

  const { data, isLoading, isLoadingError, refetch } = trpc.template.findTemplates.useQuery({
    page: page,
    perPage: perPage,
  });

  // Refetch the templates when the team URL changes.
  useEffect(() => {
    void refetch();
  }, [team?.url]);

  return (
    <div className="mx-auto max-w-screen-xl px-4 md:px-8">
      <div className="flex items-baseline justify-between">
        <div className="flex flex-row items-center">
          {team && (
            <Avatar className="dark:border-border mr-3 h-12 w-12 border-2 border-solid border-white">
              {team.avatarImageId && <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />}
              <AvatarFallback className="text-xs text-gray-400">
                {team.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          )}

          <h1 className="truncate text-2xl font-semibold md:text-3xl">
            <Trans>Templates</Trans>
          </h1>
        </div>

        <div>
          <TemplateCreateDialog templateRootPath={templateRootPath} teamId={team?.id} />
        </div>
      </div>

      <div className="relative mt-5">
        {data && data.count === 0 ? (
          <div className="text-muted-foreground/60 flex h-96 flex-col items-center justify-center gap-y-4">
            <Bird className="h-12 w-12" strokeWidth={1.5} />

            <div className="text-center">
              <h3 className="text-lg font-semibold">
                <Trans>We're all empty</Trans>
              </h3>

              <p className="mt-2 max-w-[50ch]">
                <Trans>
                  You have not yet created any templates. To create a template please upload one.
                </Trans>
              </p>
            </div>
          </div>
        ) : (
          <TemplatesTable
            data={data}
            isLoading={isLoading}
            isLoadingError={isLoadingError}
            documentRootPath={documentRootPath}
            templateRootPath={templateRootPath}
          />
        )}
      </div>
    </div>
  );
}
