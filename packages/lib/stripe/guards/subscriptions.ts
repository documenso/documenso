import { GetServerSideProps, GetServerSidePropsContext, NextApiRequest } from "next";
import { SubscriptionStatus } from "@prisma/client";
import { getToken } from "next-auth/jwt";

export const isSubscriptionsEnabled = () => {
  return process.env.NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS === "true";
};

export const isSubscribedServer = async (
  req: NextApiRequest | GetServerSidePropsContext["req"]
) => {
  const { default: prisma } = await import("@documenso/prisma");

  if (!isSubscriptionsEnabled()) {
    return true;
  }

  const token = await getToken({
    req,
  });

  if (!token || !token.email) {
    return false;
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      User: {
        email: token.email,
      },
    },
  });

  return subscription !== null && subscription.status !== SubscriptionStatus.INACTIVE;
};
