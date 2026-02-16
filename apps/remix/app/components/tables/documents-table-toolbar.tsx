import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { XIcon } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { parseToStringArray, toCommaSeparatedSearchParam } from '@documenso/lib/utils/params';
import { trpc } from '@documenso/trpc/react';
import type { TFindDocumentsInternalResponse } from '@documenso/trpc/server/document-router/find-documents-internal.types';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableFacetedFilterOption } from '@documenso/ui/primitives/data-table-faceted-filter';
import { DataTableFacetedFilter } from '@documenso/ui/primitives/data-table-faceted-filter';
import { Input } from '@documenso/ui/primitives/input';

import { PERIOD_OPTIONS } from './table-toolbar.constants';

type DocumentsTableToolbarProps = {
  teamId?: number;
  statusOptions: DataTableFacetedFilterOption[];
  statusCounts: TFindDocumentsInternalResponse['stats'];
};

export const DocumentsTableToolbar = ({
  teamId,
  statusOptions,
  statusCounts,
}: DocumentsTableToolbarProps) => {
  const { _ } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const query = searchParams.get('query') ?? '';
  const period = searchParams.get('period') ?? '';

  const selectedStatusValues = parseToStringArray(searchParams.get('status'));
  const selectedSenderValues = parseToStringArray(searchParams.get('senderIds'));

  const [searchTerm, setSearchTerm] = useState(query);
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 500);

  useEffect(() => {
    setSearchTerm(query);
  }, [query]);

  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      return;
    }

    if (debouncedSearchTerm === query) {
      return;
    }

    updateSearchParams({ query: debouncedSearchTerm || undefined, page: undefined });
  }, [debouncedSearchTerm, query, searchTerm]);

  const { data: members } = trpc.team.member.getMany.useQuery(
    {
      teamId: teamId ?? 0,
    },
    {
      enabled: teamId !== undefined,
    },
  );

  const senderOptions = useMemo(() => {
    return (members ?? []).map((member) => ({
      label: member.name ?? member.email,
      value: member.userId.toString(),
    }));
  }, [members]);

  const periodOptions = useMemo<DataTableFacetedFilterOption[]>(() => {
    return PERIOD_OPTIONS.map((option) => ({
      label: _(option.label),
      value: option.value,
    }));
  }, [_]);

  const hasActiveFilters =
    query.length > 0 ||
    selectedStatusValues.length > 0 ||
    selectedSenderValues.length > 0 ||
    (period.length > 0 && period !== 'all');

  const onResetFilters = () => {
    setSearchTerm('');

    updateSearchParams({
      query: undefined,
      status: undefined,
      senderIds: undefined,
      period: undefined,
      page: undefined,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[286px] max-w-[494px]">
        <Input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={_(msg`Search documents...`)}
          className="h-9 w-full pe-9"
        />

        {searchTerm.length > 0 && (
          <button
            type="button"
            aria-label={_(msg`Clear search`)}
            className="absolute inset-y-0 end-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSearchTerm('');
              updateSearchParams({ query: undefined, page: undefined });
            }}
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <DataTableFacetedFilter
        title={_(msg`Status`)}
        options={statusOptions}
        selectedValues={selectedStatusValues}
        counts={statusCounts}
        showSearch={false}
        onSelectedValuesChange={(values) => {
          updateSearchParams({
            status: toCommaSeparatedSearchParam(values),
            page: undefined,
          });
        }}
      />

      {teamId !== undefined && (
        <DataTableFacetedFilter
          title={_(msg`Sender`)}
          options={senderOptions}
          selectedValues={selectedSenderValues}
          showSearch
          onSelectedValuesChange={(values) => {
            updateSearchParams({
              senderIds: toCommaSeparatedSearchParam(values),
              page: undefined,
            });
          }}
        />
      )}

      <DataTableFacetedFilter
        title={_(msg`Time`)}
        options={periodOptions}
        selectedValues={period ? [period] : []}
        singleSelect
        showSearch={false}
        onSelectedValuesChange={(values) => {
          const nextPeriod = values[0];

          updateSearchParams({
            period: nextPeriod ?? undefined,
            page: undefined,
          });
        }}
      />

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onResetFilters}>
          <Trans>Reset</Trans>
          <XIcon className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
