import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@documenso/prisma";
import { Subscription } from "@prisma/client";
import { getToken } from "next-auth/jwt";

export type GetSubscriptionRequest = never;

export type GetSubscriptionResponse =
  | {
      success: false;
      message: string;
    }
  | {
      success: true;
      subscription: Subscription;
    };

export const getSubscriptionHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!process.env.NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS) {
    return res.status(500).json({
      success: false,
      message: "Subscriptions are not enabled",
    });
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const token = await getToken({
    req,
  });

  if (!token || !token.email) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      User: {
        email: token.email,
      },
    },
  });

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: "No subscription found",
    });
  }

  return res.status(200).json({
    success: true,
    subscription,
  });
};
