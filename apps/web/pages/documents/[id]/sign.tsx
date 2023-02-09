import prisma from "@documenso/prisma";
import Head from "next/head";
import { useEffect } from "react";
import { NextPageWithLayout } from "../../_app";
import { ReadStatus } from "@prisma/client";
import SignaturePad from "signature_pad";

const SignPage: NextPageWithLayout = (props: any) => {
  useEffect(() => {
    const canvas: any = document.querySelector("canvas");
    const signaturePad = new SignaturePad(canvas);
  });
  return (
    <>
      <Head>
        <title>Sign | Documenso</title>
      </Head>
      Hello, please sign at the dotted line.
      <canvas className="mx-auto bg-neon"></canvas>
      <hr></hr>
      {/* todo read/ sign version of editor => flag or own component */}
    </>
  );
};

export async function getServerSideProps(context: any) {
  const recipientToken: string = context.query["token"];

  await prisma.recipient.updateMany({
    where: {
      token: recipientToken,
    },
    data: {
      readStatus: ReadStatus.OPENED,
    },
  });

  const document = await prisma.recipient
    .findFirstOrThrow({
      where: {
        token: recipientToken,
      },
    })
    .Document();

  // todo get r

  // todo sign ui

  return {
    props: {
      document: document,
    },
  };
}

export default SignPage;
