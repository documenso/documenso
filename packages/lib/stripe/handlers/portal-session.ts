import { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "../client";


export type PortalSessionRequest = {
  body: {
    id: string;
  };
};

export type PortalSessionResponse =
  | {
      success: false;
      message: string;
    }
  | {
      success: true;
      url: string;
    };

export const portalSessionHandler = async (req: NextApiRequest, res: NextApiResponse<PortalSessionResponse>) => {
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

  const { id } = req.body;

  if (typeof id !== "string") {
    return res.status(400).json({
      success: false,
      message: "No id found in request",
    });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: id,
    return_url: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/settings/billing`,
  });

  return res.status(200).json({
    success: true,
    url: session.url,
  });
};