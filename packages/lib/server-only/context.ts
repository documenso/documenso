import { Pinecone } from '@pinecone-database/pinecone';

import { getEmbeddings } from './embeddings';

export async function getMatchesFromEmbeddings(embeddings: number[]) {
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
    environment: process.env.PINECONE_ENV!,
  });

  const pineconeIndex = pc.index('documenso-chat-with-pdf-test');

  try {
    const queryResult = await pineconeIndex.query({
      topK: 5,
      vector: embeddings,
      includeMetadata: true,
    });

    return queryResult.matches || [];
  } catch (error) {
    console.error('There was an error getting matches from embeddings: ', error);
    throw new Error('There was an error getting matches from embeddings');
  }
}

export async function getContext(query: string) {
  const queryEmbeddings = await getEmbeddings(query);
  const matches = await getMatchesFromEmbeddings(queryEmbeddings);

  const qualifyingMatches = matches.filter((match) => match.score && match.score > 0.7);
  const docs = qualifyingMatches.map((match) => match.metadata?.text);

  return docs.join('\n').substring(0, 3000);
}
