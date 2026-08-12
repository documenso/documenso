import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useQueryState } from 'nuqs';
import { useEffect, useState } from 'react';

import { documentsSearchParams } from '~/utils/documents-search-params';

export const DocumentSearch = () => {
  const { _ } = useLingui();

  const [query, setQuery] = useQueryState('query', documentsSearchParams.query);

  const [searchTerm, setSearchTerm] = useState(query ?? '');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 500);

  useEffect(() => {
    if (debouncedSearchTerm !== (query ?? '')) {
      void setQuery(debouncedSearchTerm || null);
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
