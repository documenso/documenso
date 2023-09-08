import {
  Archive,
  File,
  FileX2,
  LucideIcon,
  User as LucideUser,
  Mail,
  MailOpen,
  PenTool,
  Send,
  UserPlus2,
  UserSquare2,
} from 'lucide-react';

import { getDocsCount } from '@documenso/lib/server-only/admin/get-documents';
import { getRecipientsStats } from '@documenso/lib/server-only/admin/get-recipients';
import {
  getUsersCount,
  getUsersWithSubscriptionsCount,
} from '@documenso/lib/server-only/admin/get-users';
import {
  ReadStatus as InternalReadStatus,
  SendStatus as InternalSendStatus,
  SigningStatus as InternalSigningStatus,
} from '@documenso/prisma/client';

import { CardMetric } from '~/components/(dashboard)/metric-card/metric-card';

type TCardData = {
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

const CARD_DATA: TCardData[] = [
  {
    icon: UserSquare2,
    title: 'Total recipients in the database',
    status: 'TOTAL_RECIPIENTS',
  },
  {
    icon: MailOpen,
    title: 'Total recipients with opened count',
    status: InternalReadStatus.OPENED,
  },
  {
    icon: Mail,
    title: 'Total recipients with unopened count',
    status: InternalReadStatus.NOT_OPENED,
  },
  {
    icon: Send,
    title: 'Total recipients with sent count',
    status: InternalSendStatus.SENT,
  },
  {
    icon: Archive,
    title: 'Total recipients with unsent count',
    status: InternalSendStatus.NOT_SENT,
  },
  {
    icon: PenTool,
    title: 'Total recipients with signed count',
    status: InternalSigningStatus.SIGNED,
  },
  {
    icon: FileX2,
    title: 'Total recipients with unsigned count',
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
      <h1 className="text-4xl font-semibold">Documenso instance metrics</h1>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <CardMetric icon={LucideUser} title={'Total users in the database'} value={usersCount} />
        <CardMetric
          icon={UserPlus2}
          title={'Users with an active subscription'}
          value={usersWithSubscriptionsCount}
        />
        <CardMetric icon={File} title={'Total documents in the database'} value={docsCount} />
        {CARD_DATA.map((card) => (
          <div key={card.status}>
            <CardMetric icon={card.icon} title={card.title} value={recipientsStats[card.status]} />
          </div>
        ))}
      </div>
    </div>
  );
}
