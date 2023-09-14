import { InferGetServerSidePropsType, NextPageContext } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { truncate } from "@documenso/lib/helpers";
import { DocumentWithRecipient } from "@documenso/lib/types";
import prisma from "@documenso/prisma";
import { Button } from "@documenso/ui";
import { NextPageWithLayout } from "../../_app";
import { ArrowDownTrayIcon, CheckBadgeIcon } from "@heroicons/react/24/outline";
import { Field, Recipient } from "@prisma/client";

const Signed: NextPageWithLayout<InferGetServerSidePropsType<typeof getServerSideProps>> = ({
  document,
  fields,
  recipient,
}: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const router = useRouter();
  const allRecipientsSigned = document.Recipient?.every((r) => r.signingStatus === "SIGNED");

  return (
    <>
      <Head>
        <title>Sign | Documenso</title>
      </Head>
      <div className="mx-auto w-fit px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <CheckBadgeIcon className="text-neon mr-1 inline w-10"></CheckBadgeIcon>
        <h1 className="text-neon inline align-middle text-base font-medium">It's done!</h1>
        <p className="mt-2 text-4xl font-bold tracking-tight">
          You signed "{truncate(document.title)}"
        </p>
        <p className="mt-2 max-w-sm text-base text-gray-500" hidden={allRecipientsSigned}>
          You will be notfied when all recipients have signed.
        </p>
        <p className="mt-2 max-w-sm text-base text-gray-500" hidden={!allRecipientsSigned}>
          All recipients signed.
        </p>
        <div className="mx-auto w-fit pt-20 text-xl" hidden={!allRecipientsSigned}>
          <Button
            icon={ArrowDownTrayIcon}
            color="secondary"
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              event.preventDefault();
              event.stopPropagation();
              router.push("/api/documents/" + document.id + "?token=" + recipient.token);
            }}>
            Download "{document.title}"
          </Button>
        </div>
      </div>
      <div>
        <div className="relative mx-96">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center"></div>
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-gray-600">
        Want to send slick signing links like this one?{" "}
        <Link href="https://documenso.com" className="text-neon hover:text-neon font-medium">
          Hosted Documenso is here!
        </Link>
      </p>
    </>
  );
};

export async function getServerSideProps(context: NextPageContext) {
  const recipientToken: string = context.query["token"] as string;

  const recipient = await prisma.recipient.findFirstOrThrow({
    where: {
      token: recipientToken,
    },
    include: {
      Document: { include: { Recipient: true } },
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
      document: JSON.parse(JSON.stringify(recipient.Document)) as DocumentWithRecipient,
      fields: JSON.parse(JSON.stringify(fields)) as Field,
      recipient: JSON.parse(JSON.stringify(recipient)) as Recipient,
    },
  };
}

export default Signed;
