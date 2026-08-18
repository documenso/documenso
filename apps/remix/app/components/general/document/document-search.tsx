import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useQueryStates } from 'nuqs';
import { useEffect, useState } from 'react';

import { documentsSearchParams } from '~/utils/documents-search-params';

export const DocumentSearch = () => {
  const { _ } = useLingui();

  const [query, setQuery] = useQueryStates(
    {
      query: documentsSearchParams.query,
      page: documentsSearchParams.page,
    },
    { history: 'push' },
  );

  const [searchTerm, setSearchTerm] = useState(query ?? '');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 500);

  useEffect(() => {
    if (debouncedSearchTerm !== (query ?? '')) {
      // A new query shrinks the result set; staying on page 3 of a smaller
      // set renders an empty table. Reset the page like every sibling
      // filter does (#3196).
      void setQuery({ query: debouncedSearchTerm || null, page: null });
    }
  }, [debouncedSearchTerm, query, setQuery]);

  return (
    <Input
      type="search"
      placeholder={_(msg`Search documents...`)}
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  );
};
