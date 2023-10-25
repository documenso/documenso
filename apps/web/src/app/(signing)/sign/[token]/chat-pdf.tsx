import fs from 'fs/promises';

import { loadFileIntoPinecone } from '@documenso/lib/server-only/pinecone';
import { getFile } from '@documenso/lib/universal/upload/get-file';
import { DocumentDataType } from '@documenso/prisma/client';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import { Chat } from './chat';

type ChatPDFProps = {
  id: string;
  type: DocumentDataType;
  data: string;
  initialData: string;
};

export async function ChatPDF({ documentData }: { documentData: ChatPDFProps }) {
  const docData = await getFile(documentData);
  const fileName = `${documentData.id}}.pdf`;

  try {
    await fs.access(fileName, fs.constants.F_OK);
  } catch (err) {
    await fs.writeFile(fileName, docData);
  }
  await loadFileIntoPinecone(fileName);

  return (
    <Card className="my-8" gradient={true} degrees={200}>
      <CardContent className="mt-8 flex flex-col">
        <h2 className="text-foreground text-2xl font-semibold">Chat with the PDF</h2>
        <p className="text-muted-foreground mt-2 text-sm">Ask any questions regarding the PDF</p>
        <hr className="border-border mb-4 mt-4" />
        <Chat />
        <hr className="border-border mb-4 mt-4" />
        <p className="text-muted-foreground text-sm italic">
          Disclaimer: Never trust AI 100%. Always double check the documents yourself. Documenso is
          not liable for any issue arising from you relying 100% on the AI.
        </p>
      </CardContent>
    </Card>
  );
}
