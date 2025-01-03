import { prisma } from '..';

export const seedTestEmail = () => `user-${Date.now()}@test.documenso.com`;

type SeedSubscriptionOptions = {
  userId: string;
  priceId: string;
};

export const seedUserSubscription = async ({ userId, priceId }: SeedSubscriptionOptions) => {
  return await prisma.subscription.create({
    data: {
      userId,
      planId: Date.now().toString(),
      priceId,
      status: 'ACTIVE',
    },
  });
};
