import prisma from "@documenso/prisma";
import Head from "next/head";
import { NextPageWithLayout } from "../../_app";
import { ArrowDownTrayIcon, CheckBadgeIcon } from "@heroicons/react/24/outline";
import { Button, IconButton } from "@documenso/ui";
import Link from "next/link";
import { useRouter } from "next/router";

const SignPage: NextPageWithLayout = (props: any) => {
  const router = useRouter();
  const allRecipientsSigned = props.document.Recipient?.every(
    (r: any) => r.signingStatus === "SIGNED"
  );

  return (
    <>
      <Head>
        <title>Sign | Documenso</title>
      </Head>
      <div className="mx-auto w-fit px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <CheckBadgeIcon className="text-neon w-10 inline mr-1"></CheckBadgeIcon>
        <h1 className="text-base font-medium text-neon inline align-middle">
          It's done!
        </h1>
        <p className="mt-2 text-4xl font-bold tracking-tight">
          You signed "{props.document.title}"
        </p>
        <p
          className="mt-2 text-base text-gray-500 max-w-sm"
          hidden={allRecipientsSigned}
        >
          You will be notfied when all recipients have signed.
        </p>
        <p
          className="mt-2 text-base text-gray-500 max-w-sm"
          hidden={!allRecipientsSigned}
        >
          All recipients signed.
        </p>
        <div
          className="mx-auto w-fit text-xl pt-20"
          hidden={!allRecipientsSigned}
        >
          <Button
            icon={ArrowDownTrayIcon}
            color="secondary"
            onClick={(event: any) => {
              event.preventDefault();
              event.stopPropagation();
              router.push("/api/documents/" + props.document.id);
            }}
          >
            Download "{props.document.title}"
          </Button>
        </div>
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
        Want to send slick signing links like this one?{" "}
        <Link
          href="/signup?source=signed"
          className="font-medium text-neon hover:text-neon"
        >
          Create your own Account
        </Link>
      </p>
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
      document: recipient.Document,
      fields: fields,
    },
  };
}

export default SignPage;
