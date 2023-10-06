'use client';

import { useEffect, useState } from 'react';

import { Document, Role, Subscription } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';

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
  search: (search: string) => Promise<{ users: User[]; totalPages: number }>;
  perPage: number;
  page: number;
};

export const Users = ({ search, perPage, page }: UsersProps) => {
  const [data, setData] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState<number>(0);

  const [searchString, setSearchString] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await search(searchString);
        setData(result.users);
        setTotalPages(result.totalPages);
      } catch (err) {
        throw new Error(err);
      }
    };

    fetchData();
  }, [searchString, search]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = await search(searchString);
    setData(result.users);
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
        <UsersDataTable users={data} perPage={perPage} page={page} totalPages={totalPages} />
      </div>
    </>
  );
};
