import { handle } from 'hono/vercel';

import app from '../server/router';

export const config = {
  runtime: 'nodejs',
};

export default handle(app);
