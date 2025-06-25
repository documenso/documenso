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

    if (res.error) {
      return c.json({ error: res.error.message }, 500);
    }

    return c.json({ success: true });
  },
);
