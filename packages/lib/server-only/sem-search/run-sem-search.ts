import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { prisma } from '@documenso/prisma';
import { User } from '@documenso/prisma/client';

import { generateEmbedding } from './document-processor';

export const runSemSearch = async (user: User, query: string) => {
  if (user.identityProvider !== 'DOCUMENSO') {
    throw new Error(ErrorCode.INCORRECT_IDENTITY_PROVIDER);
  }
  console.log('I AM HERE NOW');
  console.log('THIS THE QUERY');
  console.log(query);

  // Embed query
  const queryEmbedding = await generateEmbedding(query);

  const userDocs = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    include: {
      Document: true, // Include the documents associated with the user
    },
  });

  if (userDocs && userDocs.Document) {
    const formattedQueryVector = queryEmbedding.join(',');
    let limit = 6;

    // Execute a raw SQL query to perform the similarity search
    const result = await prisma.$queryRaw`SELECT "documentId"
                                          FROM "Embedding"
                                          INNER JOIN "Document" ON "Document".id = "Embedding"."documentId"
                                          ORDER BY embedding <-> array[${formattedQueryVector}]::float8[]
                                          LIMIT ${limit};`;
    return result;
  }
};
