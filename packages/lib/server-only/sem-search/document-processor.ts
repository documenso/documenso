import { invokeTrigger } from '@trigger.dev/sdk';
import { OpenAI } from 'openai';
import { extractText } from 'unpdf';

import { GetFileOptions, getFile } from '@documenso/lib/universal/upload/get-file';
import { prisma } from '@documenso/prisma';
import { Document, DocumentData, User } from '@documenso/prisma/client';

import { client } from '../../../../apps/web/src/trigger';

export function chunkDocument(text: String, chunkSize = 500) {
  // Split the text into chunks of the given size
  let chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    input: text,
    model: 'text-embedding-ada-002',
  });
  return response.data[0].embedding;
}

export async function triggerEmbedJob(userDocs: Document[], user: User) {
  // This Job will be triggered by an event, log a joke to the console, and then wait 5 seconds before logging the punchline.
  for (const document of userDocs) {
    const docDataResult = await prisma.document.findUnique({
      where: {
        id: document.id,
      },
      include: {
        documentData: true,
      },
    });

    if (docDataResult && docDataResult.documentData.data) {
      const fileOption: GetFileOptions = {
        type: docDataResult?.documentData.type,
        data: docDataResult?.documentData.data,
      };
      const binaryData = await getFile(fileOption);
      const { totalPages, text } = await extractText(binaryData, { mergePages: true });
      console.log(`Text: ${text}`);
    }

    await client.sendEvent({
      name: 'embedTime',
      payload: {
        userId: user.id,
        documents: userDocs,
      },
    });
  }
}
