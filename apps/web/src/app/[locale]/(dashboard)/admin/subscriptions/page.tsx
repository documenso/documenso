import Link from 'next/link';

import { findSubscriptions } from '@documenso/lib/server-only/admin/get-all-subscriptions';
import type { PageParams } from '@documenso/lib/types/page-params';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';

import initTranslations from '~/app/i18n';

export default async function Subscriptions({ params: { locale } }: PageParams) {
  const subscriptions = await findSubscriptions();
  const { t } = await initTranslations(locale);

  return (
    <div>
      <h2 className="text-4xl font-semibold">{t('manage_subscriptions')}</h2>
      <div className="mt-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('id')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('created_at')}</TableHead>
              <TableHead>{t('ends_on')}</TableHead>
              <TableHead>{t('user_id')}</TableHead>
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
