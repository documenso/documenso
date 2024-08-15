import {
  File,
  FileCheck,
  FileClock,
  FileCog,
  FileEdit,
  Mail,
  MailOpen,
  PenTool,
  UserPlus,
  UserSquare2,
  Users,
} from 'lucide-react';

import { getDocumentStats } from '@documenso/lib/server-only/admin/get-documents-stats';
import { getRecipientsStats } from '@documenso/lib/server-only/admin/get-recipients-stats';
import {
  getUserWithSignedDocumentMonthlyGrowth,
  getUsersCount,
  getUsersWithSubscriptionsCount,
} from '@documenso/lib/server-only/admin/get-users-stats';
import { getSignerConversionMonthly } from '@documenso/lib/server-only/user/get-signer-conversion';

import { CardMetric } from '~/components/(dashboard)/metric-card/metric-card';

import { SignerConversionChart } from './signer-conversion-chart';
import { UserWithDocumentChart } from './user-with-document';

export default async function AdminStatsPage() {
  const [
    usersCount,
    usersWithSubscriptionsCount,
    docStats,
    recipientStats,
    signerConversionMonthly,
    // userWithAtLeastOneDocumentPerMonth,
    // userWithAtLeastOneDocumentSignedPerMonth,
    MONTHLY_USERS_SIGNED,
  ] = await Promise.all([
    getUsersCount(),
    getUsersWithSubscriptionsCount(),
    getDocumentStats(),
    getRecipientsStats(),
    getSignerConversionMonthly(),
    // getUserWithAtLeastOneDocumentPerMonth(),
    // getUserWithAtLeastOneDocumentSignedPerMonth(),
    getUserWithSignedDocumentMonthlyGrowth(),
  ]);

  return (
    <div>
      <h2 className="text-4xl font-semibold">სტატისტიკა</h2>

      <div className="mt-8 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CardMetric icon={Users} title="ყველა მომხმარებელი" value={usersCount} />
        <CardMetric icon={File} title="ყველა დოკუმენტი" value={docStats.ALL} />
        <CardMetric
          icon={UserPlus}
          title="გაიაქტიურეთ პაკეტი"
          value={usersWithSubscriptionsCount}
        />

        <CardMetric icon={FileCog} title="App Version" value={`v${process.env.APP_VERSION}`} />
      </div>

      <div className="mt-16 gap-8">
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

          <div className="mb-8 mt-4 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
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

      <div className="mt-16">
        <h3 className="text-3xl font-semibold">Charts</h3>
        <div className="mt-5 grid grid-cols-2 gap-8">
          <UserWithDocumentChart
            data={MONTHLY_USERS_SIGNED}
            title="MAU (created document)"
            tooltip="Monthly Active Users: Users that created at least one Document"
          />
          <UserWithDocumentChart
            data={MONTHLY_USERS_SIGNED}
            completed
            title="MAU (had document completed)"
            tooltip="Monthly Active Users: Users that had at least one of their documents completed"
          />
          <SignerConversionChart title="Signers that Signed Up" data={signerConversionMonthly} />
          <SignerConversionChart
            title="Total Signers that Signed Up"
            data={signerConversionMonthly}
            cummulative
          />
        </div>
      </div>
    </div>
  );
}
