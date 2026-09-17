import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useQueryStates } from 'nuqs';
import { useEffect, useState } from 'react';

import { templatesSearchParams } from '~/utils/templates-search-params';

export const TemplateSearch = () => {
  const { _ } = useLingui();

  const [{ query }, setSearchParams] = useQueryStates(
    {
      query: templatesSearchParams.query,
      page: templatesSearchParams.page,
    },
    { history: 'push' },
  );

  const [searchTerm, setSearchTerm] = useState(query ?? '');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 500);

  useEffect(() => {
    if (debouncedSearchTerm !== (query ?? '')) {
      void setSearchParams({
        query: debouncedSearchTerm || null,
        page: null,
      });
    }
  }, [debouncedSearchTerm, query, setSearchParams]);

  return (
    <Input
      type="search"
      placeholder={_(msg`Search templates...`)}
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      data-testid="templates-search-input"
    />
  );
};
