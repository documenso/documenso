import cron from 'node-cron';

import { prisma } from '@documenso/prisma';

import { documentReminderQueue } from './document-reminder-queue';

cron.schedule('0 0 */2 * *', async () => {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const pendingEnvelopes = await prisma.envelope.findMany({
    include: { documentMeta: true, recipients: true },
    where: {
      createdAt: { lt: fortyEightHoursAgo },
      completedAt: null,
      deletedAt: null,
    },
  });

  for (const doc of pendingEnvelopes) {
    const settings = doc.documentMeta?.emailSettings;
    if (!settings || typeof settings !== 'object' || !('documentReminder' in settings)) continue;

    if (settings.documentReminder) {
      await documentReminderQueue.add('send-reminder', { documentId: doc.id });
    }
  }
});
