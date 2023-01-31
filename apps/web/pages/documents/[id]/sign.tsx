import prisma from "@documenso/prisma";
import Head from "next/head";
import { ReactElement, useEffect } from "react";
import Layout from "../../../components/layout";
import Logo from "../../../components/logo";
import { NextPageWithLayout } from "../../_app";
import { Router } from "next/router";
import { ReadStatus } from "@prisma/client";
import SignaturePad from "signature_pad";

const SignPage: NextPageWithLayout = () => {
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

  // todo sign ui

  return {
    props: {},
  };
}

export default SignPage;
