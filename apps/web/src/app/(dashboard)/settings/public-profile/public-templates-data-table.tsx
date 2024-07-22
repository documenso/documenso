'use client';

import { useMemo, useState } from 'react';

import { EditIcon, FileIcon, LinkIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import type { FindTemplateRow } from '@documenso/lib/server-only/template/find-templates';
import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import type { TemplateDirectLink } from '@documenso/prisma/client';
import { TemplateType } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { ManagePublicTemplateDialog } from '~/components/templates/manage-public-template-dialog';
import { useOptionalCurrentTeam } from '~/providers/team';

type DirectTemplate = FindTemplateRow & {
  directLink: Pick<TemplateDirectLink, 'token' | 'enabled'>;
};

export const PublicTemplatesDataTable = () => {
  const team = useOptionalCurrentTeam();

  const { toast } = useToast();

  const [, copy] = useCopyToClipboard();

  const [publicTemplateDialogPayload, setPublicTemplateDialogPayload] = useState<{
    step: 'MANAGE' | 'CONFIRM_DISABLE';
    templateId: number;
  } | null>(null);

  const { data, isInitialLoading, isLoadingError, refetch } = trpc.template.findTemplates.useQuery(
    {
      teamId: team?.id,
    },
    {
      keepPreviousData: true,
    },
  );

  const { directTemplates, publicDirectTemplates, privateDirectTemplates } = useMemo(() => {
    const directTemplates = (data?.templates ?? []).filter(
      (template): template is DirectTemplate => template.directLink?.enabled === true,
    );

    const publicDirectTemplates = directTemplates.filter(
      (template) => template.directLink?.enabled === true && template.type === TemplateType.PUBLIC,
    );

    const privateDirectTemplates = directTemplates.filter(
      (template) => template.directLink?.enabled === true && template.type === TemplateType.PRIVATE,
    );

    return {
      directTemplates,
      publicDirectTemplates,
      privateDirectTemplates,
    };
  }, [data]);

  const onCopyClick = async (token: string) =>
    copy(formatDirectTemplatePath(token)).then(() => {
      toast({
        title: 'Copied to clipboard',
        description: 'The direct link has been copied to your clipboard',
      });
    });

  return (
    <div>
      <div className="dark:divide-foreground/30 dark:border-foreground/30 mt-6 divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200">
        {/* Loading and error handling states. */}
        {publicDirectTemplates.length === 0 && (
          <>
            {isInitialLoading &&
              Array(3)
                .fill(0)
                .map((_, index) => (
                  <div
                    key={index}
                    className="bg-background flex items-center justify-between gap-x-6 p-4"
                  >
                    <div className="flex gap-x-2">
                      <FileIcon className="text-muted-foreground/40 h-8 w-8" strokeWidth={1.5} />

                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>

                    <MoreHorizontalIcon className="text-muted-foreground h-5 w-5" />
                  </div>
                ))}

            {isLoadingError && (
              <div className="text-muted-foreground flex h-32 flex-col items-center justify-center text-sm">
                Unable to load your public profile templates at this time
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    void refetch();
                  }}
                >
                  Click here to retry
                </button>
              </div>
            )}

            {!isInitialLoading && (
              <div className="text-muted-foreground flex h-32 flex-col items-center justify-center text-sm">
                No public profile templates found
                <ManagePublicTemplateDialog
                  directTemplates={privateDirectTemplates}
                  trigger={
                    <button className="hover:text-muted-foreground/80 mt-1 text-xs">
                      Click here to get started
                    </button>
                  }
                />
              </div>
            )}
          </>
        )}

        {/* Public templates list. */}
        {publicDirectTemplates.map((template) => (
          <div
            key={template.id}
            className="bg-background flex items-center justify-between gap-x-6 p-4"
          >
            <div className="flex gap-x-2">
              <FileIcon
                className="text-muted-foreground/40 h-8 w-8 flex-shrink-0"
                strokeWidth={1.5}
              />

              <div>
                <p className="text-sm">{template.publicTitle}</p>
                <p className="text-xs text-neutral-400">{template.publicDescription}</p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger>
                <MoreHorizontalIcon className="text-muted-foreground h-5 w-5" />
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-52" align="center" side="left">
                <DropdownMenuLabel>Action</DropdownMenuLabel>

                <DropdownMenuItem onClick={() => void onCopyClick(template.directLink.token)}>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Copy sharable link
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    setPublicTemplateDialogPayload({
                      step: 'MANAGE',
                      templateId: template.id,
                    });
                  }}
                >
                  <EditIcon className="mr-2 h-4 w-4" />
                  Update
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() =>
                    setPublicTemplateDialogPayload({
                      step: 'CONFIRM_DISABLE',
                      templateId: template.id,
                    })
                  }
                >
                  <Trash2Icon className="mr-2 h-4 w-4" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      <ManagePublicTemplateDialog
        directTemplates={directTemplates}
        initialTemplateId={publicTemplateDialogPayload?.templateId}
        initialStep={publicTemplateDialogPayload?.step}
        isOpen={publicTemplateDialogPayload !== null}
        onIsOpenChange={(value) => {
          if (!value) {
            setPublicTemplateDialogPayload(null);
          }
        }}
      />
    </div>
  );
};
