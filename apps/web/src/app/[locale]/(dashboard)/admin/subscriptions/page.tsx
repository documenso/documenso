import Link from 'next/link';

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
  const subscriptions = await findSubscriptions();

  return (
    <div>
      <h2 className="text-4xl font-semibold">Manage subscriptions</h2>
      <div className="mt-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Ends On</TableHead>
              <TableHead>User ID</TableHead>
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
