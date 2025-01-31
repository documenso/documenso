import { useCallback, useEffect, useState } from 'react';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useNavigate, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';

export const DocumentSearch = ({ initialValue = '' }: { initialValue?: string }) => {
  const { _ } = useLingui();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(initialValue);
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 500);

  const handleSearch = useCallback(
    (term: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (term) {
        params.set('search', term);
      } else {
        params.delete('search');
      }

      void navigate(`?${params.toString()}`);
    },
    [searchParams],
  );

  useEffect(() => {
    handleSearch(searchTerm);
  }, [debouncedSearchTerm]);

  return (
    <Input
      type="search"
      placeholder={_(msg`Search documents...`)}
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  );
};
