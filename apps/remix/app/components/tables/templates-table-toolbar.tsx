import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { TemplateType } from '@prisma/client';
import { Globe2Icon, LockIcon, XIcon } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { parseToStringArray, toCommaSeparatedSearchParam } from '@documenso/lib/utils/params';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableFacetedFilterOption } from '@documenso/ui/primitives/data-table-faceted-filter';
import { DataTableFacetedFilter } from '@documenso/ui/primitives/data-table-faceted-filter';
import { Input } from '@documenso/ui/primitives/input';

export const TemplatesTableToolbar = () => {
  const { _ } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const query = searchParams.get('query') ?? '';
  const selectedTypeValues = parseToStringArray(searchParams.get('type'));

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

  const typeOptions = useMemo<DataTableFacetedFilterOption[]>(
    () => [
      {
        label: _(msg`Public`),
        value: TemplateType.PUBLIC,
        icon: Globe2Icon,
        iconClassName: 'text-green-500 dark:text-green-300',
      },
      {
        label: _(msg`Private`),
        value: TemplateType.PRIVATE,
        icon: LockIcon,
        iconClassName: 'text-blue-600 dark:text-blue-300',
      },
    ],
    [_],
  );

  const hasActiveFilters = query.length > 0 || selectedTypeValues.length > 0;

  const onResetFilters = () => {
    setSearchTerm('');

    updateSearchParams({
      query: undefined,
      type: undefined,
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
          placeholder={_(msg`Search templates...`)}
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
        title={_(msg`Type`)}
        options={typeOptions}
        selectedValues={selectedTypeValues}
        showSearch={false}
        onSelectedValuesChange={(values) => {
          updateSearchParams({
            type: toCommaSeparatedSearchParam(values),
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
