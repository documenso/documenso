import { PrismaClient } from "@prisma/client";

declare global {
  var prismaClientSingleton: PrismaClient | undefined;
}

export const prisma = globalThis.prismaClientSingleton || new PrismaClient();

export default prisma;
