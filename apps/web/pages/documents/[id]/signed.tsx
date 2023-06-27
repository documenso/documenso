import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import prisma from "@documenso/prisma";
import { Button, IconButton } from "@documenso/ui";
import { NextPageWithLayout } from "../../_app";
import { ArrowDownTrayIcon, CheckBadgeIcon } from "@heroicons/react/24/outline";
import { truncate } from "@documenso/lib/helpers";

const Signed: NextPageWithLayout = (props: any) => {
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
        <CheckBadgeIcon className="text-neon mr-1 inline w-10"></CheckBadgeIcon>
        <h1 className="text-neon inline align-middle text-base font-medium">It's done!</h1>
        <p className="mt-2 text-4xl font-bold tracking-tight">
          You signed "{truncate(props.document.title)}"
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
            onClick={(event: any) => {
              event.preventDefault();
              event.stopPropagation();
              router.push(
                "/api/documents/" + props.document.id + "?token=" + props.recipient.token
              );
            }}>
            Download "{props.document.title}"
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
      document: JSON.parse(JSON.stringify(recipient.Document)),
      fields: JSON.parse(JSON.stringify(fields)),
      recipient: JSON.parse(JSON.stringify(recipient)),
    },
  };
}

export default Signed;
