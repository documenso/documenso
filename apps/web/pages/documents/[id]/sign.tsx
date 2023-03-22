import prisma from "@documenso/prisma";
import Head from "next/head";
import { NextPageWithLayout } from "../../_app";
import { ReadStatus } from "@prisma/client";
import PDFSigner from "../../../components/editor/pdf-signer";
import Link from "next/link";
import { ClockIcon } from "@heroicons/react/24/outline";
import { FieldType, DocumentStatus } from "@prisma/client";

const SignPage: NextPageWithLayout = (props: any) => {
  return (
    <>
      <Head>
        <title>Sign | Documenso</title>
      </Head>
      {!props.expired ? (
        <PDFSigner
          document={props.document}
          recipient={props.recipient}
          fields={props.fields}
        />
      ) : (
        <>
          <div className="mx-auto w-fit px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <ClockIcon className="text-neon w-10 inline mr-1"></ClockIcon>
            <h1 className="text-base font-medium text-neon inline align-middle">
              Time flies.
            </h1>
            <p className="mt-2 text-4xl font-bold tracking-tight">
              This signing link is expired.
            </p>
            <p className="mt-2 text-base text-gray-500">
              Please ask{" "}
              {props.document.User.name
                ? `${props.document.User.name}`
                : `the sender`}{" "}
              to resend it.
            </p>
            <div className="mx-auto w-fit text-xl pt-20"></div>
          </div>
          <div>
            <div className="relative mx-96">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center"></div>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-gray-600">
            Want to send of your own?{" "}
            <Link
              href="/signup?source=expired"
              className="font-medium text-neon hover:text-neon"
            >
              Create your own Account
            </Link>
          </p>
        </>
      )}
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

  const recipient = await prisma.recipient.findFirstOrThrow({
    where: {
      token: recipientToken,
    },
    include: {
      Document: { include: { User: true } },
    },
  });

  // Document is already signed
  if (recipient.Document.status === DocumentStatus.COMPLETED) {
    return {
      redirect: {
        permanent: false,
        destination: `/documents/${recipient.Document.id}/signed`,
      },
    };
  }

  // Clean up potential unsigned free place fields from UI from previous page visits
  await prisma.field.deleteMany({
    where: {
      type: { in: [FieldType.FREE_SIGNATURE] },
      Signature: { is: null },
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

  return {
    props: {
      recipient: JSON.parse(JSON.stringify(recipient)),
      document: JSON.parse(
        JSON.stringify({ ...recipient.Document, document: "" })
      ),
      fields: JSON.parse(JSON.stringify(unsignedFields)),
      expired: recipient.expired
        ? new Date(recipient.expired) < new Date()
        : false,
    },
  };
}

export default SignPage;
