import { PrismaClient, Document, User } from "@prisma/client";
import { isENVProd } from "@documenso/lib"

declare global {
  var client: PrismaClient | undefined;
}

// Instanciate new client if non exists
const prisma = globalThis.client || new PrismaClient();

// Save for reuse in dev environment to avoid many client instances in dev where restart and reloads
if (!isENVProd) {
  globalThis.client = prisma;
}

export default prisma;
