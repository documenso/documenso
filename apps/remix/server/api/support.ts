import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';

import { plainClient } from '@documenso/lib/plain/client';

import type { HonoEnv } from '../router';
import { ZSupportTicketRequestSchema } from './support.types';

export const supportRoute = new Hono<HonoEnv>().post(
  '/',
  sValidator('json', ZSupportTicketRequestSchema),
  async (c) => {
    const { email, subject, message } = await c.req.valid('json');

    const res = await plainClient.createThread({
      title: subject,
      customerIdentifier: { emailAddress: email },
      components: [{ componentText: { text: message } }],
    });

    console.log('res', res);
    console.log('res.error', JSON.stringify(res.error, null, 2));

    if (res.error) {
      return c.json({ error: res.error.message }, 500);
    }

    return c.json({ success: true });
  },
);
