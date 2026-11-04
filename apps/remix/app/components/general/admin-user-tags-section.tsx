import { ADMIN_TAG_TYPE_MAP } from '@documenso/lib/constants/admin-tags-translations';
import { trpc } from '@documenso/trpc/react';
import type { TGetUserResponse } from '@documenso/trpc/server/admin-router/get-user.types';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Trans, useLingui } from '@lingui/react/macro';
import { TagIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import { Link } from 'react-router';

import { AdminTagDeleteDialog } from '~/components/dialogs/admin-tag-delete-dialog';

export type AdminUserTagsSectionProps = {
  user: TGetUserResponse;
};

/**
 * The user's admin tags, with where each one came from and a way to remove it.
 */
export const AdminUserTagsSection = ({ user }: AdminUserTagsSectionProps) => {
  const { t, i18n } = useLingui();

  const { data: tags = [] } = trpc.admin.tag.getMany.useQuery({ userId: user.id });

  if (tags.length === 0) {
    return null;
  }

  return (
    <Alert className="flex flex-col gap-4 p-6" variant="warning">
      <div>
        <AlertTitle className="flex items-center gap-2">
          <TagIcon className="h-4 w-4" />
          <Trans>Admin tags</Trans>
        </AlertTitle>

        <AlertDescription className="mr-2">
          <Trans>Tags placed on this account by an administrator or an admin rule.</Trans>
        </AlertDescription>
      </div>

      <ul className="flex flex-col gap-2">
        {tags.map((tag) => (
          <li
            key={tag.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning" size="small">
                  {t(ADMIN_TAG_TYPE_MAP[tag.type])}
                </Badge>

                <span className="text-muted-foreground text-xs">
                  {DateTime.fromJSDate(tag.createdAt).setLocale(i18n.locale).toRelative()}
                  {' · '}
                  {tag.adminRule ? (
                    <Trans>
                      by rule{' '}
                      <Link to={`/admin/rules/${tag.adminRule.id}`} className="underline">
                        {tag.adminRule.name}
                      </Link>
                    </Trans>
                  ) : tag.createdByUser ? (
                    <Trans>by {tag.createdByUser.email}</Trans>
                  ) : (
                    <Trans>source no longer available</Trans>
                  )}
                </span>
              </div>

              <p className="mt-1 text-foreground">{tag.description}</p>
            </div>

            <AdminTagDeleteDialog
              tag={tag}
              trigger={
                <Button variant="outline" size="sm" className="shrink-0">
                  <Trans>Remove</Trans>
                </Button>
              }
            />
          </li>
        ))}
      </ul>
    </Alert>
  );
};
