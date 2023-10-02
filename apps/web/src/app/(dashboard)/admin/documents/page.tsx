import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { findDocuments } from '@documenso/lib/server-only/admin/get-all-documents';

import { DocumentsDataTable } from './data-table';

export type DocumentsPageProps = {
  searchParams?: {
    page?: string;
    perPage?: string;
  };
};

export default async function Documents({ searchParams = {} }: DocumentsPageProps) {
  const user = await getRequiredServerComponentSession();
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 20;

  const results = await findDocuments({
    userId: user.id,
    orderBy: {
      column: 'createdAt',
      direction: 'desc',
    },
    page,
    perPage,
  });

  return (
    <div>
      <h2 className="text-4xl font-semibold">Manage documents</h2>
      <div className="mt-8">
        <DocumentsDataTable results={results} />
      </div>
    </div>
  );
}
