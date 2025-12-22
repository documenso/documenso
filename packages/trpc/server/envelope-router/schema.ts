import { z } from 'zod';

import RecipientSchema from '@documenso/prisma/generated/zod/modelSchema/RecipientSchema';

// Common schemas between envelope routes.

export const ZRecipientWithSigningUrlSchema = RecipientSchema.pick({
  id: true,
  name: true,
  email: true,
  token: true,
  role: true,
  signingOrder: true,
}).extend({
  signingUrl: z.string().describe('The URL which the recipient uses to sign the document.'),
});
