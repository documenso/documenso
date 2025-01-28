import { DateTime } from 'luxon';

import { hashSync } from '@documenso/lib/server-only/auth/hash';

import { prisma } from '.';
import { Role } from './client';

const USERS_PER_MONTH = 20;
const MONTHS_OF_HISTORY = 12;

export const seedMAUData = async () => {
  const now = DateTime.now();

  for (let monthsAgo = MONTHS_OF_HISTORY - 1; monthsAgo >= 0; monthsAgo--) {
    const monthStart = now.minus({ months: monthsAgo }).startOf('month');
    const monthEnd = monthStart.endOf('month');

    console.log(`Seeding users for ${monthStart.toFormat('yyyy-MM')}`);

    const users = await Promise.all(
      Array.from({ length: USERS_PER_MONTH }).map(async (_, index) => {
        const createdAt = DateTime.fromMillis(
          monthStart.toMillis() + Math.random() * (monthEnd.toMillis() - monthStart.toMillis()),
        ).toJSDate();

        const lastSignedIn =
          Math.random() > 0.3
            ? DateTime.fromMillis(
                createdAt.getTime() + Math.random() * (now.toMillis() - createdAt.getTime()),
              ).toJSDate()
            : createdAt;

        return prisma.user.create({
          data: {
            name: `MAU Test User ${monthsAgo}-${index}`,
            email: `mau-test-${monthsAgo}-${index}@documenso.com`,
            password: hashSync('password'),
            emailVerified: createdAt,
            createdAt,
            lastSignedIn,
            roles: [Role.USER],
          },
        });
      }),
    );

    console.log(`Created ${users.length} users for ${monthStart.toFormat('yyyy-MM')}`);
  }
};

// Run the seed if this file is executed directly
if (require.main === module) {
  seedMAUData()
    .then(() => {
      console.log('MAU seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding MAU data:', error);
      process.exit(1);
    });
}
