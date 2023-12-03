import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { prisma } from '@documenso/prisma';
import { User } from '@documenso/prisma/client';

import { triggerEmbedJob } from './document-processor';

export const runSemSearch = async (user: User, user_query) => {
  if (user.identityProvider !== 'DOCUMENSO') {
    throw new Error(ErrorCode.INCORRECT_IDENTITY_PROVIDER);
  }

  if (user.semSearchEnabled) {
    throw new Error(ErrorCode.SEM_SEARCH_ALREADY_ENABLED);
  }

  const userDocs = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    include: {
      Document: true, // Include the documents associated with the user
    },
  });

  if (userDocs && userDocs.Document) {
    for (const doc of userDocs.Document) {
      // Process each document
    }
  }
  console.log('User updated');
};
