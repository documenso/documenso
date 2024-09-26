import { Trans } from '@lingui/macro';

import { getPricesByPlan } from '@documenso/ee/server-only/stripe/get-prices-by-plan';
import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';

import { UsersDataTable } from './data-table-users';
import { search } from './fetch-users.actions';

type AdminManageUsersProps = {
  searchParams?: {
    search?: string;
    page?: number;
    perPage?: number;
  };
};

export default async function AdminManageUsers({ searchParams = {} }: AdminManageUsersProps) {
  setupI18nSSR();

  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 10;
  const searchString = searchParams.search || '';

  const [{ users, totalPages }, individualPrices] = await Promise.all([
    search(searchString, page, perPage),
    getPricesByPlan([STRIPE_PLAN_TYPE.REGULAR, STRIPE_PLAN_TYPE.COMMUNITY]).catch(() => []),
  ]);

  const individualPriceIds = individualPrices.map((price) => price.id);

  return (
    <div>
      <h2 className="text-4xl font-semibold">
        <Trans>Manage users</Trans>
      </h2>

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
