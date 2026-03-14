import { Hono } from 'hono';

import type { HonoEnv } from '../../router';
import { detectFieldsRoute } from './detect-fields';
import { detectRecipientsRoute } from './detect-recipients';

export const aiRoute = new Hono<HonoEnv>()
  .route('/detect-recipients', detectRecipientsRoute)
  .route('/detect-fields', detectFieldsRoute);
