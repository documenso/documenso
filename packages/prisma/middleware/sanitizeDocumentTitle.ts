import { PrismaClient, Document as PrismaDocument } from "@prisma/client";

function middleware(prisma: PrismaClient) {
  /***********************************/
  /* Document Title sanitize MIDDLEWARE */
  /***********************************/
  prisma.$use(async (params, next) => {
    // Check incoming query type
    if (params.model === "Document" && params.action === "create") {
      params.args.data["title"] = encodeURIComponent(params.args.data["title"]);
    }

    const result = await next(params);

    if (
      params.model === "Document" &&
      (params.action === "findFirst" || params.action === "findFirstOrThrow")
    ) {
      result["title"] = decodeURIComponent(result["title"]);
    }
    if (params.model === "Document" && params.action === "findMany") {
      result.forEach((document: PrismaDocument) => {
        document["title"] = decodeURIComponent(document["title"]);
      });
    }
    return result;
  });
}

export default middleware;
