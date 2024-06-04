import {
  File,
  FileCheck,
  FileClock,
  FileEdit,
  Mail,
  MailOpen,
  PenTool,
  User as UserIcon,
  UserPlus2,
  UserSquare2,
} from 'lucide-react';

import { getDocumentStats } from '@documenso/lib/server-only/admin/get-documents-stats';
import { getRecipientsStats } from '@documenso/lib/server-only/admin/get-recipients-stats';
import {
  getUsersCount,
  getUsersWithSubscriptionsCount,
} from '@documenso/lib/server-only/admin/get-users-stats';

import { CardMetric } from '~/components/(dashboard)/metric-card/metric-card';

export default async function AdminStatsPage() {
  const [usersCount, usersWithSubscriptionsCount, docStats, recipientStats] = await Promise.all([
    getUsersCount(),
    getUsersWithSubscriptionsCount(),
    getDocumentStats(),
    getRecipientsStats(),
  ]);

  return (
    <div>
      <h2 className="text-4xl font-semibold">სტატისტიკა</h2>

      <div className="mt-8 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CardMetric icon={UserIcon} title="ყველა მომხმარებელი" value={usersCount} />
        <CardMetric icon={File} title="ყველა დოკუმენტი" value={docStats.ALL} />
        <CardMetric
          icon={UserPlus2}
          title="გაიაქტიურეთ პაკეტი"
          value={usersWithSubscriptionsCount}
        />
        <CardMetric icon={UserPlus2} title="App Version" value={`v${process.env.APP_VERSION}`} />
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-1 lg:grid-cols-2">
        <div>
          <h3 className="text-3xl font-semibold">დოკუმენტების მეტრიკა</h3>

          <div className="mt-8 grid flex-1 grid-cols-2 gap-4">
            <CardMetric icon={File} title="ყველა დოკუმენტი" value={docStats.ALL} />
            <CardMetric icon={FileEdit} title="დრაფტი დოკუმენტები" value={docStats.DRAFT} />
            <CardMetric icon={FileClock} title="მომლოდინე დოკუმენტები" value={docStats.PENDING} />
            <CardMetric
              icon={FileCheck}
              title="ხელმოწერილი დოკუმენტები"
              value={docStats.COMPLETED}
            />
          </div>
        </div>

        <div>
          <h3 className="text-3xl font-semibold">მიმღებების მეტრიკა</h3>

          <div className="mt-8 grid flex-1 grid-cols-2 gap-4">
            <CardMetric
              icon={UserSquare2}
              title="ყველა მიმღები"
              value={recipientStats.TOTAL_RECIPIENTS}
            />
            <CardMetric icon={Mail} title="დოკუმენტები მიუვიდა" value={recipientStats.SENT} />
            <CardMetric icon={MailOpen} title="დოკუმენტები გახსნა" value={recipientStats.OPENED} />
            <CardMetric icon={PenTool} title="ხელმოწერები შეაგროვა" value={recipientStats.SIGNED} />
          </div>
        </div>
      </div>
    </div>
  );
}
