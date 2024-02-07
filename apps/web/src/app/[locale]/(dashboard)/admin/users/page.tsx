import { getPricesByType } from '@documenso/ee/server-only/stripe/get-prices-by-type';

import initTranslations from '~/app/i18n';

import { UsersDataTable } from './data-table-users';
import { search } from './fetch-users.actions';

type AdminManageUsersProps = {
  searchParams?: {
    search?: string;
    page?: number;
    perPage?: number;
  };
};

export default async function AdminManageUsers({
  params: { locale },
  searchParams = {},
}: {
  params: { locale: string };
  searchParams: AdminManageUsersProps['searchParams'];
}) {
  const { t } = await initTranslations(locale);
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 10;
  const searchString = searchParams.search || '';

  const [{ users, totalPages }, individualPrices] = await Promise.all([
    search(searchString, page, perPage),
    getPricesByType('individual'),
  ]);

  const individualPriceIds = individualPrices.map((price) => price.id);

  return (
    <div>
      <h2 className="text-4xl font-semibold">{t('manage_users')}</h2>
      <UsersDataTable
        users={users}
        individualPriceIds={individualPriceIds}
        totalPages={totalPages}
        page={page}
        perPage={perPage}
      />
    </div>
  );
}
