import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { prisma } from '@documenso/prisma';
import { User } from '@documenso/prisma/client';

import { triggerEmbedJob } from './document-processor';

export const enableSemSearch = async (user: User) => {
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
    await triggerEmbedJob(userDocs?.Document, user); //stores embeddings for each document
  }

  console.log('Documents embedded');

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      semSearchEnabled: true,
    },
  });

  console.log('User updated');
};
