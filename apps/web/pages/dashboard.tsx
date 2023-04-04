import Head from "next/head";
import { ReactElement } from "react";
import Layout from "../components/layout";
import Link from "next/link";
import type { NextPageWithLayout } from "./_app";
import {
  CheckBadgeIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { uploadDocument } from "@documenso/features";
import {
  DocumentStatus,
  SendStatus,
  SigningStatus,
  Document as PrismaDocument,
} from "@prisma/client";
import { getUserFromToken } from "@documenso/lib/server";
import { getDocumentsForUserFromToken } from "@documenso/lib/query";
import { truncate } from "fs";
import { Tooltip as ReactTooltip } from "react-tooltip";

type FormValues = {
  document: File;
};

const DashboardPage: NextPageWithLayout = (props: any) => {
  const stats = [
    {
      name: "Draft",
      stat: "0",
      icon: DocumentIcon,
      link: "/documents?filter=DRAFT",
    },
    {
      name: "Waiting for others",
      stat: "0",
      icon: UsersIcon,
      link: "/documents?filter=PENDING",
    },
    {
      name: "Completed",
      stat: "0",
      icon: CheckBadgeIcon,
      link: "/documents?filter=COMPLETED",
    },
  ];

  return (
    <>
      <Head>
        <title>Dashboard | Documenso</title>
      </Head>

      <div className="py-10 max-sm:px-4">
        <header>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
            Dashboard
          </h1>
        </header>
        <dl className="grid gap-5 mt-8 md:grid-cols-3 ">
          {stats.map((item) => (
            <Link href={item.link} key={item.name}>
              <div className="px-4 py-3 overflow-hidden bg-white rounded-lg shadow md:p-6 sm:py-5">
                <dt className="text-sm font-medium text-gray-500 truncate ">
                  <item.icon
                    className="flex-shrink-0 inline w-5 h-5 mr-3 text-neon sm:w-6 sm:h-6"
                    aria-hidden="true"
                  ></item.icon>
                  {item.name}
                </dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                  {getStat(item.name, props)}
                </dd>
              </div>
            </Link>
          ))}
        </dl>
        <div className="mt-12">
          <input
            id="fileUploadHelper"
            type="file"
            accept="application/pdf"
            onChange={(event: any) => {
              uploadDocument(event);
            }}
            hidden
          />
        </div>
        <div
          onClick={() => {
            document?.getElementById("fileUploadHelper")?.click();
          }}
          className="relative block w-full p-12 text-center border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-neon focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <svg
            className="w-12 h-12 mx-auto text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 00 20 25"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <span
            id="add_document"
            className="mt-2 block text-sm font-medium text-neon"
          >
            Add a new PDF document.
          </span>
        </div>
        <ReactTooltip
          anchorId="add_document"
          place="bottom"
          content="No preparation needed. Any PDF will do."
        />
      </div>
    </>
  );
};

DashboardPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

function getStat(name: string, props: any) {
  if (name === "Draft") return props.dashboard.drafts;
  if (name === "Waiting for others") return props.dashboard.waiting;
  if (name === "Completed") return props.dashboard.completed;
  return 0;
}

export async function getServerSideProps(context: any) {
  const user = await getUserFromToken(context.req, context.res);
  if (!user)
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };

  const documents: any[] = await getDocumentsForUserFromToken(context);

  const drafts: PrismaDocument[] = documents.filter(
    (d) => d.status === DocumentStatus.DRAFT
  );

  const waiting: any[] = documents.filter(
    (e) =>
      e.Recipient.length > 0 &&
      e.Recipient.some((r: any) => r.sendStatus === SendStatus.SENT) &&
      e.Recipient.some((r: any) => r.signingStatus === SigningStatus.NOT_SIGNED)
  );

  const completed: PrismaDocument[] = documents.filter(
    (d) => d.status === DocumentStatus.COMPLETED
  );

  return {
    props: {
      dashboard: {
        drafts: drafts.length,
        waiting: waiting.length,
        completed: completed.length,
      },
    },
  };
}

export default DashboardPage;
