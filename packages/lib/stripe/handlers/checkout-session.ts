import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@documenso/prisma";
import { stripe } from "../client";
import { getToken } from "next-auth/jwt";

export type CheckoutSessionRequest = {
  body: {
    id?: string;
    priceId: string;
  };
};

export type CheckoutSessionResponse =
  | {
      success: false;
      message: string;
    }
  | {
      success: true;
      url: string;
    };

export const checkoutSessionHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!process.env.NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS) {
    return res.status(500).json({
      success: false,
      message: "Subscriptions are not enabled",
    });
  }

  if (req.method !== "POST") {
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

  const user = await prisma.user.findFirst({
    where: {
      email: token.email,
    },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "No user found",
    });
  }

  const { id, priceId } = req.body;

  if (typeof priceId !== "string") {
    return res.status(400).json({
      success: false,
      message: "No id or priceId found in request",
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: id,
    customer_email: user.email,
    client_reference_id: String(user.id),
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    allow_promotion_codes: true,
    success_url: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/settings/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/settings/billing?canceled=true`,
  });

  return res.status(200).json({
    success: true,
    url: session.url,
  });
};
