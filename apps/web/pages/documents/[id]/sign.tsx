import prisma from "@documenso/prisma";
import Head from "next/head";
import { NextPageWithLayout } from "../../_app";
import { ReadStatus } from "@prisma/client";
import PDFSigner from "../../../components/editor/pdf-signer";

const SignPage: NextPageWithLayout = (props: any) => {
  return (
    <>
      <Head>
        <title>Sign | Documenso</title>
      </Head>
      <PDFSigner document={props.document} fields={props.fields} />
      {/* todo read/ sign version of editor => flag or own component */}
    </>
  );
};

export async function getServerSideProps(context: any) {
  const recipientToken: string = context.query["token"];

  // todo redirect to sigend of all already signed

  await prisma.recipient.updateMany({
    where: {
      token: recipientToken,
    },
    data: {
      readStatus: ReadStatus.OPENED,
    },
  });

  const recipient = await prisma.recipient.findFirstOrThrow({
    where: {
      token: recipientToken,
    },
    include: {
      Document: true,
    },
  });

  const fields = await prisma.field.findMany({
    where: {
      documentId: recipient.Document.id,
    },
    include: {
      Recipient: true,
    },
  });

  return {
    props: {
      document: recipient.Document,
      fields: fields,
    },
  };
}

export default SignPage;
