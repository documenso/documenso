import type { NextApiRequest, NextApiResponse } from "next";
import { getServerErrorFromUnknown } from "@documenso/lib/server";

type Handle<T> = (req: NextApiRequest, res: NextApiResponse) => Promise<T>;

/** Allows us to get type inference from API handler responses */
export function defaultResponder<T>(f: Handle<T>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const result = await f(req, res);
      if (result) res.json(result);
    } catch (err) {
      console.error(err);
      const error = getServerErrorFromUnknown(err);
      res.statusCode = error.statusCode;
      res.json({ message: error.message });
    }
  };
}
