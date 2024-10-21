'use client';

import { useCallback, useEffect, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';

export const DocumentSearch = ({ initialValue = '' }: { initialValue?: string }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    handleSearch(searchTerm);
  }, [debouncedSearchTerm]);

  return (
    <Input
      type="search"
      placeholder="Search documents..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  );
};
