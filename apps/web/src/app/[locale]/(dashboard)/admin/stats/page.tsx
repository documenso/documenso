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
import type { PageParams } from '@documenso/lib/types/page-params';

import initTranslations from '~/app/i18n';
import { CardMetric } from '~/components/(dashboard)/metric-card/metric-card';

export default async function AdminStatsPage({ params: { locale } }: PageParams) {
  const [usersCount, usersWithSubscriptionsCount, docStats, recipientStats] = await Promise.all([
    getUsersCount(),
    getUsersWithSubscriptionsCount(),
    getDocumentStats(),
    getRecipientsStats(),
  ]);

  const { t } = await initTranslations(locale);

  return (
    <div>
      <h2 className="text-4xl font-semibold">{t('instance_stats')}</h2>

      <div className="mt-8 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CardMetric icon={UserIcon} title={t('total_users')} value={usersCount} />
        <CardMetric icon={File} title={t('total_documents')} value={docStats.ALL} />
        <CardMetric
          icon={UserPlus2}
          title={t('active_subscriptions')}
          value={usersWithSubscriptionsCount}
        />
        <CardMetric
          icon={UserPlus2}
          title={t('app_version')}
          value={`v${process.env.APP_VERSION}`}
        />
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-1 lg:grid-cols-2">
        <div>
          <h3 className="text-3xl font-semibold">{t('document_metrics')}</h3>

          <div className="mt-8 grid flex-1 grid-cols-2 gap-4">
            <CardMetric icon={File} title={t('total_documents')} value={docStats.ALL} />
            <CardMetric icon={FileEdit} title={t('drafted_documents')} value={docStats.DRAFT} />
            <CardMetric icon={FileClock} title={t('pending_documents')} value={docStats.PENDING} />
            <CardMetric
              icon={FileCheck}
              title={t('completed_documents')}
              value={docStats.COMPLETED}
            />
          </div>
        </div>

        <div>
          <h3 className="text-3xl font-semibold">{t('recipients_metrics')}</h3>

          <div className="mt-8 grid flex-1 grid-cols-2 gap-4">
            <CardMetric
              icon={UserSquare2}
              title={t('total_recipients')}
              value={recipientStats.TOTAL_RECIPIENTS}
            />
            <CardMetric icon={Mail} title={t('document_received')} value={recipientStats.SENT} />
            <CardMetric
              icon={MailOpen}
              title={t('document_viewed')}
              value={recipientStats.OPENED}
            />
            <CardMetric
              icon={PenTool}
              title={t('signatures_collected')}
              value={recipientStats.SIGNED}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
