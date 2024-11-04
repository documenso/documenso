import Link from 'next/link';

import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { findSubscriptions } from '@documenso/lib/server-only/admin/get-all-subscriptions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';

export default async function Subscriptions() {
  await setupI18nSSR();

  const subscriptions = await findSubscriptions();

  return (
    <div>
      <h2 className="text-4xl font-semibold">
        <Trans>Manage subscriptions</Trans>
      </h2>
      <div className="mt-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>
                <Trans>Status</Trans>
              </TableHead>
              <TableHead>
                <Trans>Created At</Trans>
              </TableHead>
              <TableHead>
                <Trans>Ends On</Trans>
              </TableHead>
              <TableHead>
                <Trans>User ID</Trans>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((subscription, index) => (
              <TableRow key={index}>
                <TableCell>{subscription.id}</TableCell>
                <TableCell>{subscription.status}</TableCell>
                <TableCell>
                  {subscription.createdAt
                    ? new Date(subscription.createdAt).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  {subscription.periodEnd
                    ? new Date(subscription.periodEnd).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  <Link href={`/admin/users/${subscription.userId}`}>{subscription.userId}</Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
