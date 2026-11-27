import { trpc } from '@documenso/trpc/react';
import type {
  TGetAdminTagsRequest,
  TGetAdminTagsResponse,
} from '@documenso/trpc/server/admin-router/tags/get-admin-tags.types';
import { Button } from '@documenso/ui/primitives/button';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { Trans, useLingui } from '@lingui/react/macro';
import { DateTime } from 'luxon';
import { Link } from 'react-router';

import { AdminTagCreateDialog } from '~/components/dialogs/admin-tag-create-dialog';
import { AdminTagDeleteDialog } from '~/components/dialogs/admin-tag-delete-dialog';
import { AdminTagUpdateDialog } from '~/components/dialogs/admin-tag-update-dialog';
import { AdminTagTypeBadge } from '~/components/general/admin-tag-type-badge';

export type AdminTagsSectionProps = {
  subject: TGetAdminTagsRequest;
  className?: string;
};

export const AdminTagsSection = ({ subject, className }: AdminTagsSectionProps) => {
  const { data: tags, isLoading } = trpc.admin.tag.getMany.useQuery(subject);

  const isOrganisation = subject.type === 'organisation';

  return (
    <section className={className} aria-labelledby="admin-tags-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 id="admin-tags-heading" className="font-semibold text-lg leading-none tracking-tight">
            <Trans>Admin tags</Trans>
          </h3>
          <p className="mt-1.5 text-muted-foreground text-sm">
            {isOrganisation ? (
              <Trans>Tags on this organisation. Only admins can see them.</Trans>
            ) : (
              <Trans>Tags on this user. Only admins can see them.</Trans>
            )}
          </p>
        </div>

        <AdminTagCreateDialog subject={subject} defaultType="note" />
      </div>

      {isLoading ? (
        <Skeleton className="h-[88px] w-full rounded-lg" />
      ) : !tags || tags.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
          {isOrganisation ? <Trans>This organisation has no tags.</Trans> : <Trans>This user has no tags.</Trans>}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tags.map((tag) => (
            <AdminTagListItem key={tag.id} tag={tag} />
          ))}
        </ul>
      )}
    </section>
  );
};

type AdminTagListItemProps = {
  tag: TGetAdminTagsResponse[number];
};

const AdminTagListItem = ({ tag }: AdminTagListItemProps) => {
  const { i18n } = useLingui();

  const formatRelative = (date: Date) => DateTime.fromJSDate(date).setLocale(i18n.locale).toRelative();
  const formatFull = (date: Date) => i18n.date(date, { dateStyle: 'medium', timeStyle: 'short' });

  const creatorEmail = tag.createdByUser?.email;
  const editedAt = formatRelative(tag.updatedAt);

  // Prisma writes both timestamps from one clock read on create, so any difference means an edit.
  const isEdited = tag.updatedAt.getTime() !== tag.createdAt.getTime();

  return (
    <li
      data-testid="admin-tag"
      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="min-w-0 space-y-1.5">
        <AdminTagTypeBadge type={tag.type} />

        <p className="whitespace-pre-wrap text-foreground text-sm [overflow-wrap:anywhere]">{tag.description}</p>

        <p className="text-muted-foreground text-xs">
          {tag.adminRule ? (
            <Trans>
              Added by rule{' '}
              <Link to={`/admin/rules/${tag.adminRule.id}`} className="font-medium underline-offset-4 hover:underline">
                {tag.adminRule.name}
              </Link>
            </Trans>
          ) : creatorEmail ? (
            <Trans>Added by {creatorEmail}</Trans>
          ) : (
            <Trans>Added by a deleted user or rule</Trans>
          )}
          {' · '}
          <time dateTime={tag.createdAt.toISOString()} title={formatFull(tag.createdAt)}>
            {formatRelative(tag.createdAt)}
          </time>
          {isEdited && (
            <>
              {' · '}
              <time dateTime={tag.updatedAt.toISOString()} title={formatFull(tag.updatedAt)}>
                <Trans>Edited {editedAt}</Trans>
              </time>
            </>
          )}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <AdminTagUpdateDialog
          tag={tag}
          trigger={
            <Button variant="outline" size="sm">
              <Trans>Edit</Trans>
            </Button>
          }
        />

        <AdminTagDeleteDialog
          tag={tag}
          trigger={
            <Button variant="outline" size="sm">
              <Trans>Remove</Trans>
            </Button>
          }
        />
      </div>
    </li>
  );
};
