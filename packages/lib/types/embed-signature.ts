import { z } from 'zod';

export const ZEmbedClientUserIdSchema = z.string().trim().min(1).max(128);
