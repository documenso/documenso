// import { NextApiRequest, NextApiResponse } from 'next';
import NextAuth from 'next-auth';

import { NEXT_AUTH_OPTIONS } from '@documenso/lib/next-auth/auth-options';

export default NextAuth({
  ...NEXT_AUTH_OPTIONS,
  pages: {
    signIn: '/signin',
    signOut: '/signout',
    error: '/signin',
  },
});

// export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
//   res.json({ hello: 'world' });
// }
