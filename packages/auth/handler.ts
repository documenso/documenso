import { Hono } from 'hono';
import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

import { AuthenticationErrorCode } from './server/error-codes';
import { AuthenticationError } from './server/errors';
import { getSession } from './server/lib/session';

export const auth = new Hono();

auth.get('/session', async (c) => {
  const authorization = c.req.header('Authorization');

  const userAgent = c.req.header('User-Agent');
  const ipAddress = c.req.header('X-Forwarded-For');

  if (!authorization) {
    return new AuthenticationError(
      AuthenticationErrorCode.MissingToken,
      'Missing authorization header',
    ).toHonoResponse(c);
  }

  // Add your session validation logic here
  // eslint-disable-next-line unused-imports/no-unused-vars, prefer-const
  let { session, user } = await getSession(authorization);

  const diff = DateTime.fromJSDate(session.expires).diffNow('days');

  if (diff.days <= 3) {
    session = await prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        expires: DateTime.now().plus({ days: 7 }).toJSDate(),
      },
    });
  }

  return c.json({
    success: true,
    session,
    user,
  });
});
