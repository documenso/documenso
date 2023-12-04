import { eventTrigger } from '@trigger.dev/sdk';
import { extractText } from 'unpdf';
import { z } from 'zod';

import { GetFileOptions, getFile } from '@documenso/lib/universal/upload/get-file';
import { prisma } from '@documenso/prisma';

import { client } from '~/trigger';

import {
  chunkDocument,
  generateEmbedding,
} from '../../../../packages/lib/server-only/sem-search/document-processor';

client.defineJob({
  id: 'embedNewDocJob',
  name: 'Embed Job: Embedding a newly added document',
  version: '0.1.0',
  trigger: eventTrigger({
    name: 'embedNewDocTime',
    schema: z.object({
      userId: z.number(),
      documentId: z.number(),
    }),
  }),
  run: async (payload, io, ctx) => {
    const docDataResult = await prisma.document.findUnique({
      where: {
        id: payload.documentId,
      },
      include: {
        documentData: true,
      },
    });

    if (docDataResult && docDataResult.documentData.data) {
      const fileOption: GetFileOptions = {
        type: docDataResult.documentData.type,
        data: docDataResult.documentData.data,
      };
      const binaryData = await getFile(fileOption);
      const { totalPages, text } = await extractText(binaryData, { mergePages: true });
      console.log(`Text: ${text}`);
      const chunks = chunkDocument(text as String);

      for (const chunk of chunks) {
        //console.log('Before Embedding');
        const embedding = await generateEmbedding(chunk);
        //console.log('After Embedding');
        //embeddingsList.push(embedding);
        const embeddingResponse = await prisma.embedding.create({
          data: {
            documentId: payload.documentId,
            userId: payload.userId,
            embedding: embedding,
          },
        });
        console.log('Embedding response: ' + embeddingResponse);
      }
    }
  },
});
