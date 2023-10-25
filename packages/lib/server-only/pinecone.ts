import { Pinecone } from '@pinecone-database/pinecone';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import md5 from 'md5';

import { getEmbeddings } from './embeddings';

let pc: Pinecone | null = null;

// export type PDFPage = {
//   pageContent: string;
//   metadata: {
//     source: string;
//     pdf: {
//       version: string;
//       info: {
//         pdfformatversion: string;
//         isacroformpresent: boolean;
//         isxfapresent: boolean;
//         creator: string;
//         producer: string;
//         ceationdate: string;
//         moddate: string;
//       };
//       metadata: null;
//       totalPages: number;
//     };
//     loc: {
//       pageNumber: number;
//     };
//   };
// };

export type PDFPage = unknown;
export const getPineconeClient = () => {
  if (!pc) {
    pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: process.env.PINECONE_ENV!,
    });
  }

  return pc;
};

export async function loadFileIntoPinecone(file: string) {
  if (!file) {
    throw new Error('No file provided');
  }

  const loader = new PDFLoader(file);
  const pages: PDFPage[] = await loader.load();

  const documents = await Promise.all(pages.map(prepareDocument));

  const vectors = await Promise.all(documents.flat().map(embedDocuments));

  const client = getPineconeClient();
  const pineconeIndex = client.index('documenso-chat-with-pdf-test');

  try {
    await pineconeIndex.upsert(vectors);
  } catch (error) {
    console.error('There was an error upserting vectors: ', error);
  }
}

async function embedDocuments(doc) {
  try {
    const embeddings = await getEmbeddings(doc.pageContent);
    const hash = md5(doc.pageContent);

    return {
      id: hash,
      values: embeddings,
      metadata: {
        text: doc.metadata.text,
        pageNumber: doc.metadata.pageNumber,
      },
    };
  } catch (error) {
    console.error('There was an error embedding documents: ', error);
    throw new Error('There was an error embedding documents');
  }
}

export const truncateStringByBytes = (str: string, numBytes: number) => {
  const encoder = new TextEncoder();

  return new TextDecoder('utf-8').decode(encoder.encode(str).slice(0, numBytes));
};

async function prepareDocument(page: PDFPage) {
  let { pageContent, metadata } = page;
  pageContent = pageContent.replace(/\n/g, '');

  const splitter = new RecursiveCharacterTextSplitter();
  const docs = await splitter.splitDocuments([
    {
      pageContent,
      metadata: {
        pageNumber: metadata.loc.pageNumber,
        text: truncateStringByBytes(pageContent, 36000),
      },
    },
  ]);

  return docs;
}

function convertToAscii(input: string) {
  return input.replace(/[^\x00-\x7F]/g, '');
}
