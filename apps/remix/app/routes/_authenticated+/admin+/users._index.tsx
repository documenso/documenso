import { AdminDashboardUsersTable } from '~/components/tables/admin-dashboard-users-table';
import type { Route } from './+types/users._index';
import { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';
import { Trans } from '@lingui/react/macro';
import { findUsers } from '@documenso/lib/server-only/user/get-all-users';
import { getPricesByPlan } from '@documenso/ee-stub/server-only/stripe/get-prices-by-plan';

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  const page = Number(url.searchParams.get('page')) || 1;
  const perPage = Number(url.searchParams.get('perPage')) || 10;
  const search = url.searchParams.get('search') || '';

  const [{ users, totalPages }, prices] = await Promise.all([
    findUsers({ username: search, email: search, page, perPage }),
    getPricesByPlan([STRIPE_PLAN_TYPE.REGULAR, STRIPE_PLAN_TYPE.COMMUNITY]).catch(() => ({
      community: [],
      enterprise: [],
    })),
  ]);

  // In a stub environment, we don't have real prices, so we'll create an empty array
  const individualPriceIds: string[] = [];

  return {
    users,
    totalPages,
    individualPriceIds,
    page,
    perPage,
  };
}

export default function AdminManageUsersPage({ loaderData }: Route.ComponentProps) {
  const { users, totalPages, individualPriceIds, page, perPage } = loaderData;

  return (
    <div>
      <h2 className="text-4xl font-semibold">
        <Trans>Manage users</Trans>
      </h2>

      <AdminDashboardUsersTable
        users={users}
        individualPriceIds={individualPriceIds}
        totalPages={totalPages}
        page={page}
        perPage={perPage}
      />
    </div>
  );
}
