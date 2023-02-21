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

  const unsignedFields = await prisma.field.findMany({
    where: {
      documentId: recipient.Document.id,
      recipientId: recipient.id,
      Signature: { is: null },
    },
    include: {
      Recipient: true,
      Signature: true,
    },
  });

  if (unsignedFields.length === 0) {
    return {
      redirect: {
        permanent: false,
        destination: `/documents/${recipient.Document.id}/signed`,
      },
    };
  }

  return {
    props: {
      document: recipient.Document,
      fields: unsignedFields,
    },
  };
}

export default SignPage;
