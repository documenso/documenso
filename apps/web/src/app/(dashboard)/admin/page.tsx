import {
  Archive,
  File,
  FileX2,
  LucideIcon,
  Mail,
  MailOpen,
  PenTool,
  Send,
  User as UserIcon,
  UserPlus2,
  UserSquare2,
} from 'lucide-react';

import { getDocsCount } from '@documenso/lib/server-only/admin/get-documents-stats';
import { getRecipientsStats } from '@documenso/lib/server-only/admin/get-recipients-stats';
import {
  getUsersCount,
  getUsersWithSubscriptionsCount,
} from '@documenso/lib/server-only/admin/get-users-stats';
import {
  ReadStatus as InternalReadStatus,
  SendStatus as InternalSendStatus,
  SigningStatus as InternalSigningStatus,
} from '@documenso/prisma/client';

import { CardMetric } from '~/components/(dashboard)/metric-card/metric-card';

type CardData = {
  icon: LucideIcon;
  title: string;
  status:
    | 'TOTAL_RECIPIENTS'
    | 'OPENED'
    | 'NOT_OPENED'
    | 'SIGNED'
    | 'NOT_SIGNED'
    | 'SENT'
    | 'NOT_SENT';
};

const CARD_DATA: CardData[] = [
  {
    icon: UserSquare2,
    title: 'Recipients in the database',
    status: 'TOTAL_RECIPIENTS',
  },
  {
    icon: MailOpen,
    title: 'Opened documents',
    status: InternalReadStatus.OPENED,
  },
  {
    icon: Mail,
    title: 'Unopened documents',
    status: InternalReadStatus.NOT_OPENED,
  },
  {
    icon: Send,
    title: 'Sent documents',
    status: InternalSendStatus.SENT,
  },
  {
    icon: Archive,
    title: 'Unsent documents',
    status: InternalSendStatus.NOT_SENT,
  },
  {
    icon: PenTool,
    title: 'Signed documents',
    status: InternalSigningStatus.SIGNED,
  },
  {
    icon: FileX2,
    title: 'Unsigned documents',
    status: InternalSigningStatus.NOT_SIGNED,
  },
];

export default async function Admin() {
  const [usersCount, usersWithSubscriptionsCount, docsCount, recipientsStats] = await Promise.all([
    getUsersCount(),
    getUsersWithSubscriptionsCount(),
    getDocsCount(),
    getRecipientsStats(),
  ]);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <h2 className="text-4xl font-semibold">Instance version: {process.env.APP_VERSION}</h2>
      <div className="mt-8 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <CardMetric icon={UserIcon} title={'Total users in the database'} value={usersCount} />
        <CardMetric
          icon={UserPlus2}
          title={'Users with an active subscription'}
          value={usersWithSubscriptionsCount}
        />
      </div>
      <h2 className="my-8 text-4xl font-semibold">Document metrics</h2>
      <div className="mt-8 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <CardMetric icon={File} title={'Total documents in the database'} value={docsCount} />
      </div>

      <h2 className="my-8 text-4xl font-semibold">Recipients metrics</h2>
      <div className="mt-8 grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
        {CARD_DATA.map((card) => (
          <div key={card.status}>
            <CardMetric icon={card.icon} title={card.title} value={recipientsStats[card.status]} />
          </div>
        ))}
      </div>
    </div>
  );
}
