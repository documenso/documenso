import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
  status: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  res.status(200).json({ status: "Api up and running :)" });
}
