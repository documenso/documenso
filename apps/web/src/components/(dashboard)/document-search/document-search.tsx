'use client';

import { useCallback } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { Input } from '@documenso/ui/primitives/input';

export const DocumentSearch = ({ initialValue = '' }: { initialValue?: string }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  return (
    <Input
      type="search"
      placeholder="Search documents..."
      defaultValue={initialValue}
      onChange={(e) => handleSearch(e.target.value)}
    />
  );
};
