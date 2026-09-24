import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useQueryStates } from 'nuqs';
import { useEffect, useState } from 'react';

import { documentsSearchParams } from '~/utils/documents-search-params';

export const DocumentSearch = () => {
  const { _ } = useLingui();

  const [{ query }, setSearchParams] = useQueryStates(
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
      // Reset pagination so a new search never lands on an empty page.
      void setSearchParams({
        query: debouncedSearchTerm || null,
        page: null,
      });
    }
  }, [debouncedSearchTerm, query, setSearchParams]);

  return (
    <Input
      type="search"
      placeholder={_(msg`Search documents...`)}
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  );
};
