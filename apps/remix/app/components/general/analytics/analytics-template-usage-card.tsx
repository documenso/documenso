import type { TGetTeamAnalyticsTemplateUsageResponse } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@documenso/ui/primitives/card';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { FileTextIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { AnalyticsQueryResult } from '~/utils/analytics';
import { formatRelativeDate } from '~/utils/analytics';

import { AnalyticsQueryError } from './analytics-query-error';

/** The template shape shared by the team and organisation procedures. */
export type AnalyticsTemplate = TGetTeamAnalyticsTemplateUsageResponse['templates'][number];

export type AnalyticsTemplateUsageCardProps<TTemplate extends AnalyticsTemplate> = {
  query: AnalyticsQueryResult<{ templates: TTemplate[] }>;
  /** Where the template title links to. Return null to render a plain title. */
  getTemplateHref: (template: TTemplate) => string | null;
  /** Extra meta shown before the "Updated ..." label, e.g. the owning team name. */
  renderTemplateMeta?: (template: TTemplate) => ReactNode;
  /** Link for the "View templates" button in the empty state. Omitted when there is no single templates page. */
  templatesHref?: string;
  className?: string;
};

export const AnalyticsTemplateUsageCard = <TTemplate extends AnalyticsTemplate>({
  query,
  getTemplateHref,
  renderTemplateMeta,
  templatesHref,
  className,
}: AnalyticsTemplateUsageCardProps<TTemplate>) => {
  const { i18n } = useLingui();

  const { data, isPending, isError, isRefetching, isPlaceholderData, refetch } = query;

  return (
    <Card
      className={cn('transition-opacity', isPlaceholderData && 'opacity-60', className)}
      aria-busy={isPlaceholderData ? 'true' : undefined}
      data-testid="analytics-template-usage"
    >
      <CardHeader>
        <CardTitle>
          <Trans>Template usage</Trans>
        </CardTitle>

        <CardDescription>
          <Trans>Documents created from templates</Trans>
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isError ? (
          <AnalyticsQueryError onRetry={() => void refetch()} isRetrying={isRefetching} />
        ) : isPending || !data ? (
          <ul className="flex flex-col gap-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <li key={index} className="flex items-center gap-x-3">
                <Skeleton className="h-4 w-5" />
                <Skeleton className="h-9 w-9 shrink-0 rounded-md" />

                <div className="flex flex-1 flex-col gap-y-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>

                <Skeleton className="h-4 w-16" />
              </li>
            ))}
          </ul>
        ) : data.templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-y-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileTextIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>

            <p className="max-w-sm text-muted-foreground text-sm">
              <Trans>No documents were created from templates in this period</Trans>
            </p>

            {templatesHref && (
              <Button variant="outline" size="sm" asChild>
                <Link to={templatesHref}>
                  <Trans>View templates</Trans>
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <ol className="flex flex-col divide-y divide-border">
            {data.templates.map((template, index) => {
              const href = template.title === null ? null : getTemplateHref(template);
              const meta = renderTemplateMeta?.(template);

              return (
                <li
                  key={template.id}
                  className="flex items-center gap-x-3 py-3 first:pt-0 last:pb-0"
                  data-testid="analytics-template-row"
                >
                  <span className="w-5 shrink-0 text-muted-foreground text-xs tabular-nums" aria-hidden="true">
                    {index + 1}
                  </span>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <FileTextIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    {template.title === null ? (
                      <span className="truncate text-muted-foreground text-sm">
                        <Trans>Unavailable template</Trans>
                      </span>
                    ) : href !== null ? (
                      <Link to={href} className="truncate font-medium text-foreground text-sm hover:underline">
                        {template.title}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-foreground text-sm">{template.title}</span>
                    )}

                    {(meta || template.updatedAt !== null) && (
                      <span className="truncate text-muted-foreground text-xs">
                        {meta}
                        {meta && template.updatedAt !== null && ' · '}
                        {template.updatedAt !== null && (
                          <Trans>Updated {formatRelativeDate(template.updatedAt, i18n.locale)}</Trans>
                        )}
                      </span>
                    )}
                  </div>

                  <span className="shrink-0 rounded-md border bg-muted px-2 py-0.5 font-medium text-foreground text-xs tabular-nums">
                    <Plural value={template.count} one="# use" other="# uses" />
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
};
