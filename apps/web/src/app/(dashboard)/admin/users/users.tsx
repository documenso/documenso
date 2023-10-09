'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader } from 'lucide-react';

import { Document, Role, Subscription } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';

import { useDebouncedValue } from '~/hooks/use-debounced-value';

import { UsersDataTable } from './data-table-users';

export type SubscriptionLite = Pick<
  Subscription,
  'id' | 'status' | 'planId' | 'priceId' | 'createdAt' | 'periodEnd'
>;
export type DocumentLite = Pick<Document, 'id'>;

export type User = {
  id: number;
  name: string | null;
  email: string;
  roles: Role[];
  Subscription: SubscriptionLite[];
  Document: DocumentLite[];
};

export type UsersProps = {
  search: (_search: string) => Promise<{ users: User[]; totalPages: number }>;
  perPage: number;
  page: number;
};

export const Users = ({ search, perPage, page }: UsersProps) => {
  const [data, setData] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isPending, startTransition] = useTransition();
  const [searchString, setSearchString] = useState('');
  const debouncedSearchString = useDebouncedValue(searchString, 500);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await search(debouncedSearchString);
        setData(result.users);
        setTotalPages(result.totalPages);
      } catch (err) {
        throw new Error(err);
      }
    };

    fetchData();
  }, [debouncedSearchString, search]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await search(debouncedSearchString);
      setData(result.users);
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchString(e.target.value);
  };

  return (
    <>
      <form className="my-6 flex flex-row gap-4" onSubmit={onSubmit}>
        <Input
          type="text"
          placeholder="Search by name or email and press enter"
          value={searchString}
          onChange={handleChange}
        />
        <Button type="submit">Search</Button>
      </form>
      <div className="mt-8">
        {data.length === 0 || isPending ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <Loader className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : (
          <UsersDataTable users={data} perPage={perPage} page={page} totalPages={totalPages} />
        )}
      </div>
    </>
  );
};
