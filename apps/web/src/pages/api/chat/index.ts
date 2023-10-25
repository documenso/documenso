import { Message, OpenAIStream, StreamingTextResponse } from 'ai';
import { Configuration, OpenAIApi } from 'openai-edge';

import { getContext } from '@documenso/lib/server-only/context';

export const runtime = 'edge';

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY!,
});

const openai = new OpenAIApi(config);

export default async function handler(request: Request) {
  // console.log(request.method);
  // request.json().then((data) => console.log(data));
  // return Response.json({ message: 'world' });

  try {
    const data = await request.json();
    const lastMessage = data.messages[data.messages.length - 1];
    const context = await getContext(lastMessage.content);
    console.log('context', context);
    const prompt = {
      role: 'system',
      content: `AI assistant is a brand new, powerful, human-like artificial intelligence.
      The traits of AI include expert knowledge, helpfulness, cleverness, and articulateness.
      AI is a well-behaved and well-mannered individual.
      AI is always friendly, kind, and inspiring, and he is eager to provide vivid and thoughtful responses to the user.
      AI has the sum of all knowledge in their brain, and is able to accurately answer nearly any question about any topic in conversation.
      AI assistant is a big fan of Pinecone and Vercel.
      START CONTEXT BLOCK
      ${context}
      END OF CONTEXT BLOCK
      AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
      If the context does not provide the answer to question, the AI assistant will say, "I'm sorry, but I don't know the answer to that question".
      AI assistant will not apologize for previous responses, but instead will indicated new information was gained.
      AI assistant will not invent anything that is not drawn directly from the context.
      `,
    };
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [prompt, ...data.messages.filter((message: Message) => message.role === 'user')],
      stream: true,
    });

    const stream = OpenAIStream(response);

    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error('There was an error getting embeddings: ', error);
    throw new Error('There was an error getting embeddings');
  }
}
