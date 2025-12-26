import { handle } from 'hono/vercel';

import app from './router';

export default handle(app);
