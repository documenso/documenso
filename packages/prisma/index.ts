import { isENVProd } from "@documenso/lib";
import { Document, PrismaClient, User } from "@prisma/client";

import { sanitizeDocumentTitleMiddleware } from "./middleware";

declare global {
  var client: PrismaClient | undefined;
}

// Instanciate new client if non exists
const prisma = globalThis.client || new PrismaClient();

// Save for reuse in dev environment to avoid many client instances in dev where restart and reloads
if (!isENVProd) {
  globalThis.client = prisma;
}

// If any change on middleware, server restart is required
sanitizeDocumentTitleMiddleware(prisma);

export default prisma;
