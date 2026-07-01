import TagSchema from '@documenso/prisma/generated/zod/modelSchema/TagSchema';
import type { z } from 'zod';

export const ZTagLiteSchema = TagSchema.pick({
  id: true,
  name: true,
  type: true,
});

export type TTagLite = z.infer<typeof ZTagLiteSchema>;
