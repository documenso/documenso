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
    const resizeCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d").scale(ratio, ratio);
      // signaturePad.clear(); // otherwise isEmpty() might return incorrect value
    };
    window.addEventListener("resize", resizeCanvas);
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
