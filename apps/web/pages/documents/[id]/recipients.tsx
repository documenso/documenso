import Head from "next/head";
import { ReactElement } from "react";
import Layout from "../../../components/layout";
import { NextPageWithLayout } from "../../_app";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib";
import { PaperAirplaneIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { getUserFromToken } from "@documenso/lib/server";
import { useRouter } from "next/router";
import { toast } from "react-hot-toast";
import { getDocument } from "@documenso/lib/query";
import { Document as PrismaDocument } from "@prisma/client";
import { Breadcrumb, Button } from "@documenso/ui";

const RecipientsPage: NextPageWithLayout = (props: any) => {
  const router = useRouter();
  const title: string =
    `"` + props?.document?.title + `"` + "Recipients | Documenso";
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div className="mt-10">
        <div>
          <Breadcrumb
            document={props.document}
            items={[
              {
                title: "Documents",
                href: "/documents",
              },
              {
                title: props.document.title,
                href:
                  NEXT_PUBLIC_WEBAPP_URL + "/documents/" + props.document.id,
              },
              {
                title: "Recipients",
                href:
                  NEXT_PUBLIC_WEBAPP_URL +
                  "/documents/" +
                  props.document.id +
                  "/recipients",
              },
            ]}
          />
        </div>
        <div className="mt-2 md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              {props.document.title}
            </h2>
          </div>
          <div className="mt-4 flex flex-shrink-0 md:mt-0 md:ml-4">
            <Button
              color="primary"
              icon={PaperAirplaneIcon}
              onClick={() => {
                alert();
                // todo do stuff
              }}
              disabled={(props?.document?.Recipient?.length || 0) === 0}
            >
              Send
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-md bg-white shadow mt-10 p-6">
          <div className="border-b border-gray-200 pb-5">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Signers
            </h3>
            <p className="mt-2 max-w-4xl text-sm text-gray-500">
              The people who will sign the document.
            </p>
          </div>
          <ul role="list" className="divide-y divide-gray-200">
            {props?.document?.Recipient.map((item: any) => (
              <li key={item.id} className="px-0 py-4">
                <div>
                  <UserCircleIcon className="inline w-6 mr-2"></UserCircleIcon>
                  {item.email}
                  <span> (You)</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-b border-gray-200 pb-5 mt-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">CC</h3>
            <p className="mt-2 max-w-4xl text-sm text-gray-500">
              Anybody who should get a copy.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

RecipientsPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export async function getServerSideProps(context: any) {
  const user = await getUserFromToken(context.req, context.res);
  if (!user) return;

  const { id: documentId } = context.query;
  const document: PrismaDocument = await getDocument(
    +documentId,
    context.req,
    context.res
  );

  return {
    props: {
      document: document,
    },
  };
}

export default RecipientsPage;
