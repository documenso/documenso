import { ADMIN_RULE_MODES } from '@documenso/lib/constants/admin-rules';
import { ADMIN_RULE_MODE_MAP } from '@documenso/lib/constants/admin-rules-translations';
import { IS_DOCUMENSO_CLOUD } from '@documenso/lib/constants/app';
import { ZAdminRuleModeSchema } from '@documenso/lib/types/admin-rules';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { RadioGroupSegmented, RadioGroupSegmentedItem } from '@documenso/ui/primitives/radio-group';
import { msg } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { HistoryIcon, PlusIcon } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { Link } from 'react-router';

import {
  AdminRuleTriggerFilter,
  adminRulesSearchParams,
} from '~/components/general/admin-rules/admin-rule-trigger-filter';
import { AdminRulesTable } from '~/components/tables/admin-rules-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Rules`);
}

export default function AdminRulesPage() {
  const { t } = useLingui();

  const [{ mode, trigger }, setFilters] = useQueryStates(adminRulesSearchParams, { history: 'push' });

  const { data, isLoading, isLoadingError } = trpc.admin.rule.getMany.useQuery();

  // getMany returns every rule, so the filters and per mode counts are applied here. Memoised,
  // because the table recreates every cell when these arrays change, which closes an open row menu.
  const allRules = useMemo(() => data ?? [], [data]);

  const rules = useMemo(
    () =>
      allRules.filter(
        (rule) => (mode === null || rule.mode === mode) && (trigger === null || rule.trigger === trigger),
      ),
    [allRules, mode, trigger],
  );

  const allRuleIds = useMemo(() => allRules.map((rule) => rule.id), [allRules]);

  const hasFilters = mode !== null || trigger !== null;

  const totalCount = allRules.length;
  const visibleCount = rules.length;

  const onClearFilters = () => {
    void setFilters({ mode: null, trigger: null });
  };

  if (!IS_DOCUMENSO_CLOUD()) {
    return null;
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h2 className="font-semibold text-4xl">
            <Trans>Rules</Trans>
          </h2>

          <p className="mt-2 text-muted-foreground text-sm">
            <Trans>
              Run checks when something happens on the platform. Rules run top to bottom, and an enforced rule set to
              stop on match skips the rules below it.
            </Trans>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/rules/events">
              <HistoryIcon className="mr-2 -ml-1 h-4 w-4" />
              <Trans>Events</Trans>
            </Link>
          </Button>

          <Button asChild>
            <Link to="/admin/rules/new">
              <PlusIcon className="mr-2 -ml-1 h-4 w-4" />
              <Trans>Create rule</Trans>
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <RadioGroupSegmented
              value={mode ?? ALL_MODES_VALUE}
              onValueChange={(value) =>
                void setFilters({ mode: ZAdminRuleModeSchema.nullable().catch(null).parse(value) })
              }
              className="gap-1 p-1"
              aria-label={t`Filter by mode`}
            >
              <RadioGroupSegmentedItem value={ALL_MODES_VALUE} className="px-3 py-1.5 text-[13px]">
                <Trans>All</Trans> <ModeCount count={totalCount} />
              </RadioGroupSegmentedItem>

              {ADMIN_RULE_MODES.map((value) => (
                <RadioGroupSegmentedItem key={value} value={value} className="px-3 py-1.5 text-[13px]">
                  {t(ADMIN_RULE_MODE_MAP[value])}{' '}
                  <ModeCount count={allRules.filter((rule) => rule.mode === value).length} />
                </RadioGroupSegmentedItem>
              ))}
            </RadioGroupSegmented>

            <AdminRuleTriggerFilter value={trigger} onChange={(value) => void setFilters({ trigger: value })} />
          </div>

          <span className="text-[13px] text-muted-foreground">
            {data && (
              <Trans>
                Showing {visibleCount} of <Plural value={totalCount} one="# rule" other="# rules" />
              </Trans>
            )}
          </span>
        </div>

        <AdminRulesTable
          rules={rules}
          allRuleIds={allRuleIds}
          isLoading={isLoading}
          isLoadingError={isLoadingError}
          hasFilters={hasFilters}
          onClearFilters={onClearFilters}
        />
      </div>
    </div>
  );
}

const ALL_MODES_VALUE = 'ALL';

const ModeCount = ({ count }: { count: number }) => (
  <span className="ml-0.5 font-normal text-muted-foreground tabular-nums">{count}</span>
);
