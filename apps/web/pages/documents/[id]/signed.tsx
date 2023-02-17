import prisma from "@documenso/prisma";
import Head from "next/head";
import { NextPageWithLayout } from "../../_app";
import { ReadStatus } from "@prisma/client";

const SignPage: NextPageWithLayout = (props: any) => {
  return (
    <>
      <Head>
        <title>Sign | Documenso</title>
      </Head>
      You signed,thanks for playing.
    </>
  );
};

export async function getServerSideProps(context: any) {
  const recipientToken: string = context.query["token"];

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
