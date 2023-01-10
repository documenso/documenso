import { PrismaClient } from "@prisma/client";

declare global {
  var client: PrismaClient | undefined;
}

// Instanciate new client if non exists
const prisma = globalThis.client || new PrismaClient();

// Save for reuse in dev environment to avoid many client instances in dev where restart and reloads
if (process.env.NODE_ENV !== "production") {
  globalThis.client = prisma;
}

export default prisma;
