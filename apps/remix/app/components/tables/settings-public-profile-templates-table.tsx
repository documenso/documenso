import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { type TemplateDirectLink, TemplateType } from '@prisma/client';
import { EditIcon, FileIcon, LinkIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import { trpc } from '@documenso/trpc/react';
import type { FindTemplateRow } from '@documenso/trpc/server/template-router/schema';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { ManagePublicTemplateDialog } from '~/components/dialogs/public-profile-template-manage-dialog';

type DirectTemplate = FindTemplateRow & {
  directLink: Pick<TemplateDirectLink, 'token' | 'enabled'>;
};

export const SettingsPublicProfileTemplatesTable = () => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [, copy] = useCopyToClipboard();

  const [publicTemplateDialogPayload, setPublicTemplateDialogPayload] = useState<{
    step: 'MANAGE' | 'CONFIRM_DISABLE';
    templateId: number;
  } | null>(null);

  const { data, isLoading, isLoadingError, refetch } = trpc.template.findTemplates.useQuery(
    {},
    {
      placeholderData: (previousData) => previousData,
    },
  );

  const { directTemplates, publicDirectTemplates, privateDirectTemplates } = useMemo(() => {
    const directTemplates = (data?.data ?? []).filter(
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
        title: _(msg`Copied to clipboard`),
        description: _(msg`The direct link has been copied to your clipboard`),
      });
    });

  return (
    <div>
      <div className="dark:divide-foreground/30 dark:border-foreground/30 mt-6 divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200">
        {/* Loading and error handling states. */}
        {publicDirectTemplates.length === 0 && (
          <>
            {isLoading &&
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
                <Trans>Unable to load your public profile templates at this time</Trans>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    void refetch();
                  }}
                >
                  <Trans>Click here to retry</Trans>
                </button>
              </div>
            )}

            {!isLoading && (
              <div className="text-muted-foreground flex h-32 flex-col items-center justify-center text-sm">
                <Trans>No public profile templates found</Trans>
                <ManagePublicTemplateDialog
                  directTemplates={privateDirectTemplates}
                  trigger={
                    <button className="hover:text-muted-foreground/80 mt-1 text-xs">
                      <Trans>Click here to get started</Trans>
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
                <DropdownMenuLabel>
                  <Trans>Action</Trans>
                </DropdownMenuLabel>

                <DropdownMenuItem onClick={() => void onCopyClick(template.directLink.token)}>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  <Trans>Copy sharable link</Trans>
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
                  <Trans>Update</Trans>
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
                  <Trans>Remove</Trans>
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
