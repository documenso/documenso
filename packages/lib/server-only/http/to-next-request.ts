import { NextRequest } from 'next/server';

export const toNextRequest = (req: Request) => {
  const headers = Object.fromEntries(req.headers.entries());

  return new NextRequest(req, {
    headers: headers,
  });
};
