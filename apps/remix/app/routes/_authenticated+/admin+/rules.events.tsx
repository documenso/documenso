import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { ADMIN_RULE_MODES } from '@documenso/lib/constants/admin-rules';
import { ADMIN_RULE_MODE_MAP } from '@documenso/lib/constants/admin-rules-translations';
import { IS_DOCUMENSO_CLOUD } from '@documenso/lib/constants/app';
import { ZAdminRuleModeSchema } from '@documenso/lib/types/admin-rules';
import { trpc } from '@documenso/trpc/react';
import { ZAdminRuleMatchPeriodSchema } from '@documenso/trpc/server/admin-router/rules/find-admin-rule-matches.types';
import { Input } from '@documenso/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Switch } from '@documenso/ui/primitives/switch';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { ListFilterIcon, ShieldBanIcon, WorkflowIcon } from 'lucide-react';
import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';

import { AdminRuleModeBadge } from '~/components/general/admin-rules/admin-rule-badges';
import {
  AdminRuleTriggerFilter,
  adminRulesSearchParams,
} from '~/components/general/admin-rules/admin-rule-trigger-filter';
import { FilterPill } from '~/components/general/filter-pill';
import { AdminRuleMatchesTable } from '~/components/tables/admin-rule-matches-table';
import { appMetaTags } from '~/utils/meta';

const ALL_TIME_VALUE = 'all';

export function meta() {
  return appMetaTags(msg`Rule Events`);
}

export default function AdminRuleEventsPage() {
  const { t } = useLingui();

  const [filters, setFilters] = useQueryStates(
    {
      ...adminRulesSearchParams,
      query: parseAsString.withDefault(''),
      ruleId: parseAsString,
      period: parseAsStringEnum([...ZAdminRuleMatchPeriodSchema.options]),
      blockedOnly: parseAsBoolean.withDefault(false),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(20),
    },
    { history: 'push' },
  );

  const debouncedQuery = useDebouncedValue(filters.query, 500);

  // Rule names for the rule filter; getMany returns every rule.
  const { data: rules } = trpc.admin.rule.getMany.useQuery();

  const hasFilters =
    filters.query !== '' ||
    filters.ruleId !== null ||
    filters.trigger !== null ||
    filters.mode !== null ||
    filters.period !== null ||
    filters.blockedOnly;

  const onClearFilters = () => {
    void setFilters({
      query: '',
      ruleId: null,
      trigger: null,
      mode: null,
      period: null,
      blockedOnly: false,
      page: 1,
    });
  };

  if (!IS_DOCUMENSO_CLOUD()) {
    return null;
  }

  const selectedRule = rules?.find((rule) => rule.id === filters.ruleId) ?? null;

  return (
    <div>
      <div className="min-w-0">
        <h2 className="font-semibold text-4xl">
          <Trans>Rule events</Trans>
        </h2>

        <p className="mt-2 text-muted-foreground text-sm">
          <Trans>Every time a rule matched an event, including monitor mode evaluations that took no action.</Trans>
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="search"
            className="sm:max-w-xs"
            placeholder={t`Search by user name or email`}
            value={filters.query}
            onChange={(event) => void setFilters({ query: event.target.value, page: 1 }, { history: 'replace' })}
          />

          <Select
            value={filters.period ?? ALL_TIME_VALUE}
            onValueChange={(value) =>
              void setFilters({ period: ZAdminRuleMatchPeriodSchema.nullable().catch(null).parse(value), page: 1 })
            }
          >
            <SelectTrigger className="text-muted-foreground sm:w-[180px]" aria-label={t`Period`}>
              <SelectValue />
            </SelectTrigger>

            <SelectContent position="popper">
              <SelectItem value={ALL_TIME_VALUE}>
                <Trans>All time</Trans>
              </SelectItem>
              <SelectItem value="24h">
                <Trans>Last 24 hours</Trans>
              </SelectItem>
              <SelectItem value="7d">
                <Trans>Last 7 days</Trans>
              </SelectItem>
              <SelectItem value="30d">
                <Trans>Last 30 days</Trans>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            icon={WorkflowIcon}
            label={<Trans>Rule</Trans>}
            value={filters.ruleId}
            onChange={(value) => void setFilters({ ruleId: value, page: 1 })}
            selectedLabel={selectedRule?.name}
            enableSearch
            searchPlaceholder={t`Search rules`}
            options={(rules ?? []).map((rule) => ({
              value: rule.id,
              label: rule.name,
            }))}
          />

          <AdminRuleTriggerFilter
            value={filters.trigger}
            onChange={(value) => void setFilters({ trigger: value, page: 1 })}
          />

          <FilterPill
            icon={ListFilterIcon}
            label={<Trans>Mode</Trans>}
            value={filters.mode}
            onChange={(value) =>
              void setFilters({ mode: ZAdminRuleModeSchema.nullable().catch(null).parse(value), page: 1 })
            }
            selectedLabel={filters.mode && <AdminRuleModeBadge mode={filters.mode} />}
            // Disabled rules are never evaluated, so no match has that mode.
            options={ADMIN_RULE_MODES.filter((value) => value !== 'DISABLED').map((value) => ({
              value,
              label: t(ADMIN_RULE_MODE_MAP[value]),
            }))}
          />

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch
              checked={filters.blockedOnly}
              onCheckedChange={(checked) => void setFilters({ blockedOnly: checked, page: 1 })}
            />
            <ShieldBanIcon className="h-4 w-4 text-muted-foreground" />
            <Trans>Blocked only</Trans>
          </label>
        </div>

        <AdminRuleMatchesTable
          showRule
          filters={{
            query: debouncedQuery || undefined,
            ruleId: filters.ruleId ?? undefined,
            trigger: filters.trigger ?? undefined,
            mode: filters.mode ?? undefined,
            period: filters.period ?? undefined,
            blockedOnly: filters.blockedOnly || undefined,
          }}
          page={filters.page}
          perPage={filters.perPage}
          onPaginationChange={(page, perPage) => void setFilters({ page, perPage })}
          hasFilters={hasFilters}
          onClearFilters={onClearFilters}
        />
      </div>
    </div>
  );
}
