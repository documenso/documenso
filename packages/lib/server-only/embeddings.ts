import { Configuration, OpenAIApi } from 'openai-edge';

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY!,
});

const openai = new OpenAIApi(config);

export async function getEmbeddings(text: string) {
  try {
    const response = await openai.createEmbedding({
      model: 'text-embedding-ada-002',
      input: text.replace(/\n/g, ' '),
    });

    const result = await response.json();

    return result.data[0].embedding;
  } catch (error) {
    console.error('There was an error getting embeddings: ', error);
    throw new Error('There was an error getting embeddings');
  }
}
